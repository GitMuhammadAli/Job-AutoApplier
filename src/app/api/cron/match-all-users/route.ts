import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { sendNotificationEmail, getNotificationFrom } from "@/lib/email";
import { newJobsNotificationTemplate } from "@/lib/email-templates";
import { decryptSettingsFields, hasDecryptionFailure } from "@/lib/encryption";
import { buildExistingJobKeys, isDuplicateByKey } from "@/lib/matching/location-filter";
import { LIMITS, TIMEOUTS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import { acquireLock, releaseLock } from "@/lib/system-lock";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("match-all-users");

  const locked = await acquireLock("match-all-users");
  if (!locked) {
    await tracker.skipped("Another match-all-users is running");
    return NextResponse.json({ skipped: true, reason: "Another match-all-users is running" });
  }

  const startTime = Date.now();
  const cursorUserId = req.nextUrl.searchParams.get("cursor") || undefined;
  const batchSize = Math.min(parseInt(req.nextUrl.searchParams.get("batch") || "50", 10) || 50, 500);

  try {
    const users = await prisma.userSettings.findMany({
      where: { isOnboarded: true, keywords: { isEmpty: false } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { userId: "asc" },
      take: batchSize,
      ...(cursorUserId ? { skip: 1, cursor: { userId: cursorUserId } } : {}),
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No configured users", matched: 0, nextCursor: null });
    }

    // Only match jobs that haven't been matched to ANY user yet.
    // This keeps workload constant regardless of DB size — only truly new
    // unmatched jobs are processed, not the entire 3-day window.
    const rawUnmatched = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        userJobs: { none: {} },
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
        } catch (err) {
          const isPrismaUnique = typeof err === "object" && err !== null && (err as Record<string, unknown>).code === "P2002";
          if (!isPrismaUnique) {
            console.error(`[MatchAllUsers] Unexpected error creating UserJob for user ${userId}, job ${job.id}:`, err);
          }
        }
      }

      const goodMatches = matchedJobDetails.filter((j) => j.matchScore >= 50);
      if (goodMatches.length > 0 && settings.emailNotifications && !hasDecryptionFailure(settings as Record<string, unknown>, "notificationEmail")) {
        const notifEmail = settings.notificationEmail || settings.user.email;
        if (notifEmail) {
          try {
            const { subject, html } = newJobsNotificationTemplate(
              settings.user.name || "there",
              goodMatches.slice(0, LIMITS.NOTIFICATION_JOBS),
            );
            const notifFrom = getNotificationFrom();
            if (!notifFrom) continue;
            await sendNotificationEmail({
              from: notifFrom,
              to: notifEmail,
              subject,
              html,
            });
          } catch (err) { console.warn("[MatchAllUsers] Notification email failed:", err); }
        }
      }

      results.push({ userId, matched });
    }

    const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);

    // Cursor for next batch: if we processed fewer users than requested, we're done
    const timedOut = Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS;
    const lastProcessedIdx = results.length - 1;
    const nextCursor = (results.length < users.length || timedOut) && lastProcessedIdx >= 0
      ? users[lastProcessedIdx].userId
      : users.length === batchSize
        ? users[users.length - 1].userId
        : null;

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "match-all-users",
        message: `Matched ${totalMatched} jobs across ${results.length} users from ${unmatchedJobs.length} available jobs${nextCursor ? " (more users pending)" : ""}`,
        metadata: { users: results.length, availableJobs: unmatchedJobs.length, totalMatched, nextCursor },
      },
    });

    await tracker.success({ processed: totalMatched, metadata: { users: results.length, availableJobs: unmatchedJobs.length, nextCursor } });

    // Fire-and-forget downstream crons after matching completes
    const cronSecret = process.env.CRON_SECRET;
    const origin = req.nextUrl.origin;
    const downstream: Record<string, string> = {};

    const fireAndForget = (name: string, path: string) => {
      try {
        const url = new URL(path, origin);
        url.searchParams.set("secret", cronSecret || "");
        fetch(url.toString()).catch((e) => {
          console.error(`[MatchAllUsers] Fire-and-forget ${name} failed:`, e);
        });
        downstream[name] = "triggered";
      } catch (e) {
        downstream[name] = `failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    };

    if (totalMatched > 0) {
      fireAndForget("notify-matches", "/api/cron/notify-matches");
      fireAndForget("instant-apply", "/api/cron/instant-apply");
    }

    return NextResponse.json({
      success: true,
      users: results.length,
      availableJobs: unmatchedJobs.length,
      totalMatched,
      perUser: results,
      nextCursor,
      downstream,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("MatchAllUsers", error, "Match failed");
  } finally {
    await releaseLock("match-all-users").catch(() => {});
  }
}
