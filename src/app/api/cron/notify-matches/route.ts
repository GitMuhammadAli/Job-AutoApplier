import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobMatchNotification } from "@/lib/email/notifications";
import {
  checkNotificationLimit,
  recordNotification,
} from "@/lib/notification-limiter";
import { decryptSettingsFields, hasDecryptionFailure } from "@/lib/encryption";
import { TIMEOUTS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import { pushNewJobMatches, isPushConfigured } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("notify-matches");

  try {
    // Get all users with email notifications enabled
    const users = await prisma.userSettings.findMany({
      where: {
        OR: [
          { emailNotifications: true },
          { pushNotifications: true },
        ],
      },
      select: {
        userId: true,
        fullName: true,
        notificationEmail: true,
        emailNotifications: true,
        pushNotifications: true,
        user: { select: { email: true, name: true } },
      },
      take: 500,
    });

    let notified = 0;
    const startTime = Date.now();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    for (const rawUser of users) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;
      const user = decryptSettingsFields(rawUser);
      if (hasDecryptionFailure(user as Record<string, unknown>, "notificationEmail")) {
        console.warn(`[NotifyMatches] Skipping user ${rawUser.userId}: notificationEmail decryption failed`);
        continue;
      }
      const email = user.notificationEmail || user.user.email;
      if (!email) continue;

      // Find the last notification time for this user to avoid re-notifying
      const lastNotification = await prisma.systemLog.findFirst({
        where: { type: "notification", source: user.userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const cutoff = lastNotification?.createdAt ?? oneDayAgo;

      // Find new high-quality matched jobs since last notification (score >= 50)
      const newJobs = await prisma.userJob.findMany({
        where: {
          userId: user.userId,
          isDismissed: false,
          matchScore: { gte: 50 },
          createdAt: { gte: cutoff },
        },
        include: {
          globalJob: {
            select: {
              title: true,
              company: true,
              location: true,
              salary: true,
              applyUrl: true,
              source: true,
            },
          },
        },
        orderBy: { matchScore: "desc" },
        take: 20,
      });

      if (newJobs.length === 0) continue;

      // Check notification limits (max 1/hour, 3/day)
      const canNotify = await checkNotificationLimit(user.userId);
      if (!canNotify) continue;

      const jobNotifications = newJobs.map((uj) => ({
        title: uj.globalJob.title,
        company: uj.globalJob.company,
        location: uj.globalJob.location,
        salary: uj.globalJob.salary,
        matchScore: uj.matchScore || 0,
        applyUrl: uj.globalJob.applyUrl,
        source: uj.globalJob.source,
        matchReasons: uj.matchReasons,
      }));

      try {
        const displayName = user.fullName || user.user.name || "there";

        if (user.emailNotifications && email) {
          await sendJobMatchNotification(
            email,
            jobNotifications,
            displayName,
          );
        }

        if (user.pushNotifications && isPushConfigured()) {
          const topJob = newJobs[0]
            ? { title: newJobs[0].globalJob.title, company: newJobs[0].globalJob.company }
            : undefined;
          await pushNewJobMatches(user.userId, newJobs.length, topJob).catch((e) =>
            console.warn(`[NotifyMatches] Push failed for ${user.userId}:`, e),
          );
        }

        await recordNotification(
          user.userId,
          `Sent ${newJobs.length} job match notification to ${email || "push"}`,
        );
        notified++;
      } catch (err) {
        console.error(`Failed to notify ${email}:`, err);
      }
    }

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "notify-matches",
        message: `Notified ${notified} users about new job matches`,
        metadata: { usersNotified: notified },
      },
    });

    await tracker.success({ processed: notified, metadata: { totalUsers: users.length } });

    return NextResponse.json({ success: true, usersNotified: notified });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("NotifyMatches", error, "Notification failed");
  }
}
