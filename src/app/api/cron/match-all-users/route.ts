import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { sendEmail } from "@/lib/email/sender";
import { newJobsNotificationTemplate } from "@/lib/email-templates";
import { decryptSettingsFields } from "@/lib/encryption";
import { buildExistingJobKeys, isDuplicateByKey } from "@/lib/matching/location-filter";
import { LIMITS, TIMEOUTS } from "@/lib/constants";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false;
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

  const startTime = Date.now();

  try {
    const users = await prisma.userSettings.findMany({
      where: { isOnboarded: true, keywords: { isEmpty: false } },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 500,
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No configured users", matched: 0 });
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const rawUnmatched = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        createdAt: { gte: threeDaysAgo },
      },
      take: LIMITS.MATCH_BATCH,
    });

    // Round-robin by source for fair processing across all platforms
    const bySource = new Map<string, typeof rawUnmatched>();
    for (const job of rawUnmatched) {
      const list = bySource.get(job.source) || [];
      list.push(job);
      bySource.set(job.source, list);
    }
    const sources = Array.from(bySource.keys());
    const unmatchedJobs: typeof rawUnmatched = [];
    let rrIdx = 0;
    let rrMore = true;
    while (rrMore) {
      rrMore = false;
      for (const src of sources) {
        const list = bySource.get(src)!;
        if (rrIdx < list.length) {
          unmatchedJobs.push(list[rrIdx]);
          if (rrIdx + 1 < list.length) rrMore = true;
        }
      }
      rrIdx++;
    }

    if (unmatchedJobs.length === 0) {
      return NextResponse.json({
        message: "No recent jobs to match",
        matched: 0,
      });
    }

    const results: { userId: string; matched: number }[] = [];

    for (const rawSettings of users) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      const settings = decryptSettingsFields(rawSettings);
      const userId = settings.userId;
      const resumes = await prisma.resume.findMany({
        where: { userId, isDeleted: false },
        select: { id: true, name: true, content: true, detectedSkills: true, isDefault: true },
        take: 50,
      });

      const existingUserJobs = await prisma.userJob.findMany({
        where: { userId },
        select: { globalJobId: true, globalJob: { select: { title: true, company: true } } },
        take: LIMITS.EXISTING_JOB_IDS,
      });
      const existingJobIds = new Set(existingUserJobs.map((j) => j.globalJobId));
      const existingJobKeys = buildExistingJobKeys(
        existingUserJobs.map((j) => j.globalJob)
      );

      let matched = 0;
      const matchedJobDetails: Array<{
        title: string;
        company: string;
        location: string | null;
        salary: string | null;
        matchScore: number;
        applyUrl: string | null;
        source: string;
        matchReasons: string[];
      }> = [];

      for (const job of unmatchedJobs) {
        if (existingJobIds.has(job.id)) continue;
        if (isDuplicateByKey(existingJobKeys, job.title, job.company)) continue;

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
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            matchScore: match.score,
            applyUrl: job.applyUrl,
            source: job.source,
            matchReasons: match.reasons,
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
              goodMatches.slice(0, LIMITS.NOTIFICATION_JOBS),
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

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "match-all-users",
        message: `Matched ${totalMatched} jobs across ${users.length} users from ${unmatchedJobs.length} available jobs`,
        metadata: { users: users.length, availableJobs: unmatchedJobs.length, totalMatched },
      },
    });

    return NextResponse.json({
      success: true,
      users: users.length,
      availableJobs: unmatchedJobs.length,
      totalMatched,
      perUser: results,
    });
  } catch (error) {
    console.error("[MatchAllUsers] Error:", error);
    return NextResponse.json(
      { error: "Match failed", details: String(error) },
      { status: 500 },
    );
  }
}
