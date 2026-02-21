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
import type { ScrapedJob, SearchQuery } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type ScraperFn = (queries: SearchQuery[]) => Promise<ScrapedJob[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  jsearch: (q) => fetchJSearch(q, 6),
  indeed: (q) => fetchIndeed(q),
  remotive: (q) => fetchRemotive(q),
  arbeitnow: () => fetchArbeitnow(),
  adzuna: (q) => fetchAdzuna(q),
  linkedin: (q) => fetchLinkedIn(q),
  rozee: (q) => fetchRozee(q),
  google: (q) => fetchGoogleJobs(q),
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

    // Scrape each source independently — one failure doesn't kill others
    for (const source of sources) {
      const scraperFn = SCRAPERS[source];
      if (!scraperFn) continue;

      try {
        const jobs = await scraperFn(queries);
        let newCount = 0;
        let updatedCount = 0;

        for (const job of jobs) {
          try {
            if (!job.category) {
              job.category = categorizeJob(
                job.title,
                job.skills || [],
                job.description || "",
              );
            }

            const existing = await prisma.globalJob.findUnique({
              where: {
                sourceId_source: { sourceId: job.sourceId, source: job.source },
              },
              select: { id: true },
            });

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

        results.push({
          source,
          found: jobs.length,
          new: newCount,
          updated: updatedCount,
          status: "success",
        });

        await prisma.systemLog.create({
          data: {
            type: "scrape",
            source,
            message: `${source}: ${jobs.length} found, ${newCount} new, ${updatedCount} updated`,
            metadata: {
              found: jobs.length,
              new: newCount,
              updated: updatedCount,
            },
          },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        results.push({
          source,
          found: 0,
          new: 0,
          updated: 0,
          status: "failed",
          error: errMsg,
        });
        console.error(`[Scrape] ${source} failed:`, error);

        await prisma.systemLog.create({
          data: {
            type: "error",
            source,
            message: `Scraper ${source} failed: ${errMsg}`,
          },
        });
      }
    }

    const failedCount = results.filter((r) => r.status === "failed").length;
    if (failedCount > sources.length / 2 && process.env.NOTIFICATION_EMAIL) {
      await sendNotificationEmail({
        from: `JobPilot <${process.env.NOTIFICATION_EMAIL}>`,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `JobPilot Alert: ${failedCount}/${sources.length} scrapers failed`,
        html: `<p>Failed sources: ${results
          .filter((r) => r.status === "failed")
          .map((r) => `${r.source}: ${r.error}`)
          .join("<br>")}</p>`,
      }).catch(() => {});
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
