import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobMatchNotification } from "@/lib/email/notifications";
import { checkNotificationLimit, recordNotification } from "@/lib/notification-limiter";
import { decryptField } from "@/lib/encryption";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users with email notifications enabled
    const users = await prisma.userSettings.findMany({
      where: { emailNotifications: true },
      select: {
        userId: true,
        fullName: true,
        notificationEmail: true,
        user: { select: { email: true, name: true } },
      },
    });

    let notified = 0;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    for (const user of users) {
      const email = decryptField(user.notificationEmail) || user.user.email;
      if (!email) continue;

      // Find new high-quality matched jobs from last 24h (score >= 50 only)
      const newJobs = await prisma.userJob.findMany({
        where: {
          userId: user.userId,
          isDismissed: false,
          matchScore: { gte: 50 },
          createdAt: { gte: oneDayAgo },
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
        await sendJobMatchNotification(
          email,
          jobNotifications,
          decryptField(user.fullName) || user.user.name || "there"
        );
        await recordNotification(user.userId, `Sent ${newJobs.length} job match notification to ${email}`);
        notified++;
      } catch (err) {
        console.error(`Failed to notify ${email}:`, err);
      }
    }

    return NextResponse.json({ success: true, usersNotified: notified });
  } catch (error) {
    console.error("Notify matches error:", error);
    return NextResponse.json({ error: "Notification failed", details: String(error) }, { status: 500 });
  }
}
