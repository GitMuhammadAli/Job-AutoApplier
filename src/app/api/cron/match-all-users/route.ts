import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMatchScore, MATCH_THRESHOLDS } from "@/lib/matching/score-engine";
import { sendEmail } from "@/lib/email/sender";
import { newJobsNotificationTemplate } from "@/lib/email-templates";
import { decryptSettingsFields } from "@/lib/encryption";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

/**
 * Runs 3x daily for all users.
 * Matches non-fresh GlobalJobs (fresh ones are handled by instant-apply) to users.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.userSettings.findMany({
      where: { isOnboarded: true, keywords: { isEmpty: false } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No configured users", matched: 0 });
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const unmatchedJobs = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        createdAt: { gte: threeDaysAgo },
      },
      take: 500,
    });

    if (unmatchedJobs.length === 0) {
      return NextResponse.json({ message: "No recent jobs to match", matched: 0 });
    }

    const results: { userId: string; matched: number }[] = [];

    for (const rawSettings of users) {
      const settings = decryptSettingsFields(rawSettings);
      const userId = settings.userId;
      const resumes = await prisma.resume.findMany({
        where: { userId },
        select: { id: true, name: true, content: true, isDefault: true },
      });

      const existingJobIds = new Set(
        (await prisma.userJob.findMany({
          where: { userId },
          select: { globalJobId: true },
          take: 10000,
        })).map((j) => j.globalJobId)
      );

      let matched = 0;
      const matchedJobDetails: Array<{
        title: string; company: string; location: string | null;
        salary: string | null; matchScore: number; applyUrl: string | null;
        source: string; matchReasons: string[];
      }> = [];

      for (const job of unmatchedJobs) {
        if (existingJobIds.has(job.id)) continue;

        const match = computeMatchScore(job, settings, resumes);
        if (match.score < MATCH_THRESHOLDS.SHOW_ON_KANBAN) continue;

        try {
          await prisma.userJob.create({
            data: {
              userId,
              globalJobId: job.id,
              stage: "SAVED",
              matchScore: match.score,
              matchReasons: match.reasons,
            },
          });
          matched++;
          matchedJobDetails.push({
            title: job.title, company: job.company,
            location: job.location, salary: job.salary,
            matchScore: match.score, applyUrl: job.applyUrl,
            source: job.source, matchReasons: match.reasons,
          });
        } catch {
          // Duplicate constraint
        }
      }

      const goodMatches = matchedJobDetails.filter((j) => j.matchScore >= 50);
      if (goodMatches.length > 0 && settings.emailNotifications) {
        const notifEmail = settings.notificationEmail || settings.user.email;
        if (notifEmail) {
          try {
            const { subject, html } = newJobsNotificationTemplate(
              settings.user.name || "there",
              goodMatches.slice(0, 20),
            );
            await sendEmail({
              from: `JobPilot <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "notifications@jobpilot.app"}>`,
              to: notifEmail,
              subject,
              html,
            });
          } catch {}
        }
      }

      results.push({ userId, matched });
    }

    const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);

    return NextResponse.json({
      success: true,
      users: users.length,
      availableJobs: unmatchedJobs.length,
      totalMatched,
      perUser: results,
    });
  } catch (error) {
    console.error("Match all users error:", error);
    return NextResponse.json(
      { error: "Match failed", details: String(error) },
      { status: 500 }
    );
  }
}
