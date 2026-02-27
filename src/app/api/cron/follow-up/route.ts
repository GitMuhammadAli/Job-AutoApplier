import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIMITS, TIMEOUTS, FOLLOW_UP } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import { sendNotificationEmail, getNotificationFrom } from "@/lib/email";
import { followUpReminderTemplate } from "@/lib/email-templates";
import { decryptSettingsFields, hasDecryptionFailure } from "@/lib/encryption";
import { checkNotificationLimit, logNotificationSent } from "@/lib/notification-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("follow-up");
  const startTime = Date.now();

  try {
    // M7: Use constants instead of magic numbers
    const ghostedCutoff = new Date();
    ghostedCutoff.setDate(ghostedCutoff.getDate() - FOLLOW_UP.GHOSTED_AFTER_DAYS);

    const followUpCutoff = new Date();
    followUpCutoff.setDate(followUpCutoff.getDate() - FOLLOW_UP.FOLLOW_UP_AFTER_DAYS);

    const ghosted = await prisma.userJob.updateMany({
      where: {
        stage: "APPLIED",
        updatedAt: { lt: ghostedCutoff },
      },
      data: { stage: "GHOSTED" },
    });

    const needsFollowUp = await prisma.userJob.findMany({
      where: {
        stage: "APPLIED",
        followUpCount: { lt: FOLLOW_UP.MAX_FOLLOW_UPS },
        updatedAt: { lt: followUpCutoff },
        OR: [
          { lastFollowUpAt: null },
          { lastFollowUpAt: { lt: followUpCutoff } },
        ],
      },
      select: {
        id: true,
        userId: true,
        globalJob: { select: { title: true, company: true } },
        application: { select: { sentAt: true } },
      },
      take: LIMITS.FOLLOW_UP_BATCH,
    });

    let processed = 0;
    const userFollowUps = new Map<string, Array<{ title: string; company: string; daysSince: number; userJobId: string }>>();

    for (const uj of needsFollowUp) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      try {
        await prisma.$transaction([
          prisma.userJob.update({
            where: { id: uj.id },
            data: {
              followUpCount: { increment: 1 },
              lastFollowUpAt: new Date(),
            },
          }),
          prisma.activity.create({
            data: {
              userJobId: uj.id,
              userId: uj.userId,
              type: "FOLLOW_UP_FLAGGED",
              description: "Follow-up reminder flagged",
            },
          }),
        ]);
        processed++;

        // Collect for notification
        const sentAt = uj.application?.sentAt;
        const daysSince = sentAt ? Math.floor((Date.now() - sentAt.getTime()) / 86400000) : 7;
        const list = userFollowUps.get(uj.userId) || [];
        list.push({ title: uj.globalJob.title, company: uj.globalJob.company, daysSince, userJobId: uj.id });
        userFollowUps.set(uj.userId, list);
      } catch (err) {
        console.error(`[FollowUp] Error for job ${uj.id}:`, err);
      }
    }

    // Send follow-up reminder notifications
    for (const [userId, jobs] of Array.from(userFollowUps.entries())) {
      try {
        const canNotify = await checkNotificationLimit(userId);
        if (!canNotify) continue;
        const rawSettings = await prisma.userSettings.findUnique({ where: { userId }, include: { user: { select: { email: true, name: true } } } });
        if (!rawSettings?.emailNotifications) continue;
        const settings = decryptSettingsFields(rawSettings);
        if (hasDecryptionFailure(settings as Record<string, unknown>, "notificationEmail")) continue;
        const notifEmail = settings.notificationEmail || settings.user.email;
        if (!notifEmail) continue;

        const notifFrom = getNotificationFrom();
        if (!notifFrom) continue;
        const { subject, html } = followUpReminderTemplate(settings.user.name || "there", jobs);
        await sendNotificationEmail({
          from: notifFrom,
          to: notifEmail,
          subject,
          html,
        });
        await logNotificationSent(userId, `Follow-up reminder: ${jobs.length} jobs`);
      } catch (err) {
        console.warn(`[FollowUp] Notification failed for user ${userId}:`, err);
      }
    }

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "follow-up",
        message: `Marked ${ghosted.count} ghosted, flagged ${processed} follow-ups`,
        metadata: { ghosted: ghosted.count, followUps: processed },
      },
    });

    await tracker.success({ processed, metadata: { ghosted: ghosted.count } });

    return NextResponse.json({
      success: true,
      ghosted: ghosted.count,
      followUps: processed,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("FollowUp", error, "Follow-up failed");
  }
}
