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
import { categorizeJob } from "@/lib/job-categorizer";
import { sendNotificationEmail } from "@/lib/email";
import { sendAlertWebhook } from "@/lib/webhooks";
import { runScraper, updateRunJobsSaved } from "@/lib/scrapers/scraper-runner";
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

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type ScraperFn = (queries: SearchQuery[]) => Promise<ScrapedJob[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  jsearch: (q) => fetchJSearch(q, 8),
  indeed: (q) => fetchIndeed(q),
  remotive: (q) => fetchRemotive(q),
  arbeitnow: () => fetchArbeitnow(),
  adzuna: (q) => fetchAdzuna(q),
  linkedin: (q) => fetchLinkedIn(q),
  rozee: (q) => fetchRozee(q),
  google: (q) => fetchGoogleJobs(q),
};

// Fallback mapping: when primary fails, try these
const FALLBACKS: Record<string, { fn: ScraperFn; source: string } | undefined> = {
  linkedin: process.env.RAPIDAPI_KEY ? { fn: (q) => fetchJSearch(q, 8), source: "jsearch" } : undefined,
  indeed: process.env.RAPIDAPI_KEY ? { fn: (q) => fetchJSearch(q, 8), source: "jsearch" } : undefined,
  rozee: process.env.SERPAPI_KEY ? { fn: (q) => fetchGoogleJobs(q), source: "google" } : undefined,
};

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

  const mode = req.nextUrl.searchParams.get("mode") || "all";

  try {
    let sources: string[];
    switch (mode) {
      case "priority":
        sources = await getPriorityPlatforms();
        break;
      case "free":
        sources = ["indeed", "remotive", "arbeitnow", "linkedin", "rozee"];
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
          timeoutMs: 45000,
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

        // Batch lookup: find all existing jobs in one query instead of N+1
        const sourceKeys = runResult.jobs.map((j) => ({ sourceId: j.sourceId, source: j.source }));
        const existingJobs = await prisma.globalJob.findMany({
          where: {
            OR: sourceKeys.map((k) => ({ sourceId: k.sourceId, source: k.source })),
          },
          select: { id: true, sourceId: true, source: true },
        });
        for (const job of runResult.jobs) {
          try {
            const existing = existingJobs.find((e) => e.source === job.source && e.sourceId === job.sourceId);

            if (existing) {
              await prisma.globalJob.update({
                where: { id: existing.id },
                data: {
                  lastSeenAt: new Date(),
                  isActive: true,
                  ...(job.description ? { description: job.description } : {}),
                  ...(job.salary ? { salary: job.salary } : {}),
                  ...(job.applyUrl ? { applyUrl: job.applyUrl } : {}),
                  ...(job.companyEmail
                    ? { companyEmail: job.companyEmail }
                    : {}),
                },
              });
              updatedCount++;
            } else {
              await prisma.globalJob.create({
                data: {
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
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
              });
              newCount++;
            }
          } catch {
            // skip individual upsert failures
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
        }).catch(() => {});

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
        }).catch(() => {});
      }
      await sendAlertWebhook({
        title: `JobPilot: ${failedCount}/${sources.length} scrapers failed`,
        message: alertMsg,
        severity: "error",
      });
    }

    // On Hobby plan, this single daily cron also triggers matching and sending
    const shouldMatch = req.nextUrl.searchParams.get("match") === "true";
    const shouldSend = req.nextUrl.searchParams.get("send") === "true";

    let matchResult = null;
    let sendResult = null;

    if (shouldMatch) {
      try {
        const matchUrl = new URL(
          "/api/cron/match-all-users",
          req.nextUrl.origin,
        );
        const response = await fetch(matchUrl.toString(), {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        });
        matchResult = response.ok ? "triggered" : `failed: ${response.status}`;
      } catch (e) {
        matchResult = `failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (shouldSend) {
      try {
        const sendUrl = new URL("/api/cron/send-queued", req.nextUrl.origin);
        const response = await fetch(sendUrl.toString(), {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        });
        sendResult = response.ok ? "triggered" : `failed: ${response.status}`;
      } catch (e) {
        sendResult = `failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      results,
      totalNew: results.reduce((s, r) => s + r.new, 0),
      totalUpdated: results.reduce((s, r) => s + r.updated, 0),
      durationMs: Date.now() - startTime,
      matchResult,
      sendResult,
    });
  } catch (error) {
    console.error("Scrape global error:", error);
    return NextResponse.json(
      { error: "Scrape failed", details: String(error) },
      { status: 500 },
    );
  }
}
