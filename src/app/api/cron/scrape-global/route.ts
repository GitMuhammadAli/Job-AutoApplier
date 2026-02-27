import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateSearchQueries } from "@/lib/scrapers/keyword-aggregator";
import {
  getPaidSourcesToday,
  getPriorityPlatforms,
} from "@/lib/scrapers/source-rotation";
import { fetchJSearch } from "@/lib/scrapers/jsearch";
import { fetchIndeed } from "@/lib/scrapers/indeed";
import { fetchRemotive } from "@/lib/scrapers/remotive";
import { fetchArbeitnow } from "@/lib/scrapers/arbeitnow";
import { fetchAdzuna } from "@/lib/scrapers/adzuna";
import { fetchLinkedIn } from "@/lib/scrapers/linkedin";
import { fetchRozee } from "@/lib/scrapers/rozee";
import { fetchGoogleJobs } from "@/lib/scrapers/google-jobs";
import { fetchGoogleHiringPosts } from "@/lib/scrapers/google-hiring-posts";
import { categorizeJob } from "@/lib/job-categorizer";
import { TIMEOUTS } from "@/lib/constants";
import { sendNotificationEmail } from "@/lib/email";
import { sendAlertWebhook } from "@/lib/webhooks";
import { runScraper, updateRunJobsSaved } from "@/lib/scrapers/scraper-runner";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import type { ScrapedJob, SearchQuery } from "@/types";

function sanitizeScrapedText(text: string | null): string | null {
  if (!text) return text;
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const maxDuration = 10;
export const dynamic = "force-dynamic";

type ScraperFn = (queries: SearchQuery[]) => Promise<ScrapedJob[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  jsearch: (q) => fetchJSearch(q),
  indeed: (q) => fetchIndeed(q),
  remotive: (q) => fetchRemotive(q),
  arbeitnow: () => fetchArbeitnow(),
  adzuna: (q) => fetchAdzuna(q),
  linkedin: (q) => fetchLinkedIn(q),
  rozee: (q) => fetchRozee(q),
  google: (q) => fetchGoogleJobs(q),
  linkedin_posts: (q) => fetchGoogleHiringPosts(q, 3),
};

// Fallback mapping: when primary fails, try these
const FALLBACKS: Record<string, { fn: ScraperFn; source: string } | undefined> = {
  linkedin: process.env.RAPIDAPI_KEY ? { fn: (q) => fetchJSearch(q, 3), source: "jsearch" } : undefined,
  indeed: process.env.RAPIDAPI_KEY ? { fn: (q) => fetchJSearch(q, 3), source: "jsearch" } : undefined,
  rozee: process.env.SERPAPI_KEY ? { fn: (q) => fetchGoogleJobs(q), source: "google" } : undefined,
};

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const mode = req.nextUrl.searchParams.get("mode") || "all";
  const tracker = createCronTracker("scrape-global");

  try {
    let sources: string[];
    switch (mode) {
      case "priority":
        sources = await getPriorityPlatforms();
        break;
      case "free":
        sources = ["indeed", "remotive", "arbeitnow", "linkedin", "rozee", "linkedin_posts"];
        break;
      case "paid":
        sources = getPaidSourcesToday();
        break;
      default:
        sources = [
          "indeed",
          "remotive",
          "arbeitnow",
          "linkedin",
          "rozee",
          "linkedin_posts",
          ...getPaidSourcesToday(),
        ];
        sources = sources.filter((s, i) => sources.indexOf(s) === i);
    }

    if (sources.length === 0) {
      return NextResponse.json({ message: "No sources to scrape", mode });
    }

    const queries = await aggregateSearchQueries(
      mode === "paid" ? "paid" : undefined,
    );
    if (queries.length === 0) {
      return NextResponse.json({
        message: "No user keywords configured",
        mode,
        scraped: 0,
      });
    }

    const results: {
      source: string;
      found: number;
      new: number;
      updated: number;
      status: string;
      error?: string;
    }[] = [];

    const startTime = Date.now();

    // Run all scrapers in parallel via scraper runner (timeout, fallback, run recording)
    const scraperTasks = sources
      .filter((source) => SCRAPERS[source])
      .map(async (source) => {
        const fallback = FALLBACKS[source];
        const runResult = await runScraper({
          source,
          fn: SCRAPERS[source],
          queries,
          timeoutMs: TIMEOUTS.SCRAPER_DEADLINE_MS,
          fallbackFn: fallback?.fn,
          fallbackSource: fallback?.source,
        });

        // Save jobs to DB
        let newCount = 0;
        let updatedCount = 0;

        // Sanitize and categorize all jobs first
        for (const job of runResult.jobs) {
          job.description = sanitizeScrapedText(job.description);
          job.title = sanitizeScrapedText(job.title) || job.title;
          job.company = sanitizeScrapedText(job.company) || job.company;
          if (!job.category) {
            job.category = categorizeJob(job.title, job.skills || [], job.description || "");
          }
        }

        // Batch lookup + batch write (same pattern as scrape-source.ts)
        if (runResult.jobs.length > 0) {
          const sourceKeys = runResult.jobs.map((j) => ({ sourceId: j.sourceId, source: j.source }));
          const existingJobs = await prisma.globalJob.findMany({
            where: { OR: sourceKeys.map((k) => ({ sourceId: k.sourceId, source: k.source })) },
            select: { id: true, sourceId: true, source: true },
          });
          const existingSet = new Set(existingJobs.map((e) => `${e.source}:${e.sourceId}`));
          const existingIdMap = new Map(existingJobs.map((e) => [`${e.source}:${e.sourceId}`, e.id] as const));

          const newJobs = runResult.jobs.filter((j) => !existingSet.has(`${j.source}:${j.sourceId}`));
          const existingIds = runResult.jobs
            .filter((j) => existingSet.has(`${j.source}:${j.sourceId}`))
            .map((j) => existingIdMap.get(`${j.source}:${j.sourceId}`))
            .filter((id): id is string => !!id);

          // Batch create new jobs
          if (newJobs.length > 0) {
            const now = new Date();
            try {
              const result = await prisma.globalJob.createMany({
                data: newJobs.map((job) => ({
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  description: job.description,
                  salary: job.salary,
                  jobType: job.jobType,
                  experienceLevel: job.experienceLevel,
                  category: job.category,
                  skills: job.skills,
                  postedDate: job.postedDate,
                  source: job.source,
                  sourceId: job.sourceId,
                  sourceUrl: job.sourceUrl,
                  applyUrl: job.applyUrl,
                  companyUrl: job.companyUrl,
                  companyEmail: job.companyEmail,
                  isActive: true,
                  isFresh: true,
                  firstSeenAt: now,
                  lastSeenAt: now,
                })),
                skipDuplicates: true,
              });
              newCount = result.count;
            } catch (err) {
              console.warn(`[ScrapeGlobal] Batch create failed for ${source}:`, err);
            }
          }

          // Batch update existing jobs
          if (existingIds.length > 0) {
            try {
              const result = await prisma.globalJob.updateMany({
                where: { id: { in: existingIds } },
                data: { lastSeenAt: new Date(), isActive: true },
              });
              updatedCount = result.count;
            } catch (err) {
              console.warn(`[ScrapeGlobal] Batch update failed for ${source}:`, err);
            }
          }
        }

        // Update run with saved count
        await updateRunJobsSaved(runResult.runId, newCount);

        // Log to SystemLog (maintains backward compat)
        const logStatus = runResult.status === "success" || runResult.status === "partial" ? "success" : "failed";
        await prisma.systemLog.create({
          data: {
            type: logStatus === "success" ? "scrape" : "error",
            source,
            message: logStatus === "success"
              ? `${source}: ${runResult.jobs.length} found, ${newCount} new, ${updatedCount} updated`
              : `Scraper ${source} ${runResult.status}: ${runResult.errorMessage}`,
            metadata: {
              found: runResult.jobs.length,
              new: newCount,
              updated: updatedCount,
              durationMs: runResult.durationMs,
              status: logStatus,
              ...(runResult.errorMessage ? { errorMessage: runResult.errorMessage } : {}),
            },
          },
        }).catch((logErr) => console.error(`[ScrapeGlobal] Failed to write log for ${source}:`, logErr));

        return {
          source,
          found: runResult.jobs.length,
          new: newCount,
          updated: updatedCount,
          status: runResult.status,
          error: runResult.errorMessage,
        };
      });

    const settled = await Promise.allSettled(scraperTasks);
    for (const s of settled) {
      if (s.status === "fulfilled") {
        results.push(s.value);
      }
    }

    const failedCount = results.filter((r) => r.status === "failed" || r.status === "timeout").length;
    const failedSources = results
      .filter((r) => r.status === "failed" || r.status === "timeout")
      .map((r) => `${r.source}: ${r.error}`);
    if (failedCount > sources.length / 2) {
      const alertMsg = `Failed sources: ${failedSources.join("; ")}`;
      if (process.env.NOTIFICATION_EMAIL) {
        await sendNotificationEmail({
          from: `JobPilot <${process.env.NOTIFICATION_EMAIL}>`,
          to: process.env.NOTIFICATION_EMAIL,
          subject: `JobPilot Alert: ${failedCount}/${sources.length} scrapers failed`,
          html: `<p>${alertMsg.replace(/;/g, "<br>")}</p>`,
        }).catch((emailErr) => console.error("[ScrapeGlobal] Failed to send alert email:", emailErr));
      }
      await sendAlertWebhook({
        title: `JobPilot: ${failedCount}/${sources.length} scrapers failed`,
        message: alertMsg,
        severity: "error",
      });
    }

    // Fire-and-forget: trigger downstream crons without waiting for their response.
    // On Hobby plan (10s limit), scraping often consumes 7-8s, leaving no budget
    // to await downstream responses. By not awaiting, the fetch initiates the
    // Vercel function invocation which then runs independently.
    const shouldMatch = req.nextUrl.searchParams.get("match") === "true";
    const shouldSend = req.nextUrl.searchParams.get("send") === "true";

    let matchResult = null;
    let sendResult = null;

    if (shouldMatch) {
      try {
        const matchUrl = new URL("/api/cron/match-all-users", req.nextUrl.origin);
        fetch(matchUrl.toString(), {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        }).catch((e) => {
          console.error("[ScrapeGlobal] Fire-and-forget match-all-users failed:", e);
        });
        matchResult = "triggered (fire-and-forget)";
      } catch (e) {
        matchResult = `failed to dispatch: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (shouldSend) {
      try {
        const sendUrl = new URL("/api/cron/send-queued", req.nextUrl.origin);
        fetch(sendUrl.toString(), {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        }).catch((e) => {
          console.error("[ScrapeGlobal] Fire-and-forget send-queued failed:", e);
        });
        sendResult = "triggered (fire-and-forget)";
      } catch (e) {
        sendResult = `failed to dispatch: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const totalNew = results.reduce((s, r) => s + r.new, 0);
    await tracker.success({ processed: totalNew, failed: failedCount, metadata: { mode, sources: results.length } });

    return NextResponse.json({
      success: true,
      mode,
      results,
      totalNew,
      totalUpdated: results.reduce((s, r) => s + r.updated, 0),
      durationMs: Date.now() - startTime,
      matchResult,
      sendResult,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("ScrapeGlobal", error, "Scrape failed");
  }
}
