import { prisma } from "@/lib/prisma";
import type { ScrapedJob, SearchQuery } from "@/types";
import { categorizeJob } from "@/lib/job-categorizer";

function sanitizeScrapedText(text: string | null, stripHtml = true): string | null {
  if (!text) return text;
  let out = text;
  if (stripHtml) {
    out = out
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ");
  }
  return out
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeAndUpsert(
  sourceName: string,
  scraperFn: (queries: SearchQuery[]) => Promise<ScrapedJob[]>,
  queries: SearchQuery[]
): Promise<{ newCount: number; updatedCount: number; error?: string }> {
  const jobs = await scraperFn(queries);
  if (jobs.length === 0) {
    await logScrapeResult(sourceName, 0, 0, 0);
    return { newCount: 0, updatedCount: 0 };
  }

  // 1. Sanitize all jobs (CPU-only, no DB)
  for (const job of jobs) {
    job.description = sanitizeScrapedText(job.description);
    job.title = sanitizeScrapedText(job.title) || job.title;
    job.company = sanitizeScrapedText(job.company) || job.company;
    job.location = sanitizeScrapedText(job.location, false) || job.location;
    job.salary = sanitizeScrapedText(job.salary, false) || job.salary;
    if (!job.category) {
      job.category = categorizeJob(job.title, job.skills || [], job.description || "");
    }
  }

  // 2. Single query: find which sourceIds already exist
  const sourceKeys = jobs.map((j) => ({ sourceId: j.sourceId, source: j.source }));
  const existing = await prisma.globalJob.findMany({
    where: { OR: sourceKeys.map((k) => ({ sourceId: k.sourceId, source: k.source })) },
    select: { id: true, sourceId: true, source: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.source}:${e.sourceId}`));
  const existingIdMap = new Map(existing.map((e) => [`${e.source}:${e.sourceId}`, e.id] as const));

  // 3. Split into new vs existing
  const newJobs = jobs.filter((j) => !existingSet.has(`${j.source}:${j.sourceId}`));
  const existingJobs = jobs.filter((j) => existingSet.has(`${j.source}:${j.sourceId}`));

  // 4. Batch create new jobs (single query)
  let newCount = 0;
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
      console.warn(`[${sourceName}] Batch create failed:`, err);
    }
  }

  // 5. Batch update existing jobs — mark as active + refresh lastSeenAt
  let updatedCount = 0;
  if (existingJobs.length > 0) {
    const existingIds = existingJobs
      .map((j) => existingIdMap.get(`${j.source}:${j.sourceId}`))
      .filter((id): id is string => !!id);

    if (existingIds.length > 0) {
      try {
        const result = await prisma.globalJob.updateMany({
          where: { id: { in: existingIds } },
          data: { lastSeenAt: new Date(), isActive: true },
        });
        updatedCount = result.count;
      } catch (err) {
        console.warn(`[${sourceName}] Batch update failed:`, err);
      }
    }
  }

  await logScrapeResult(sourceName, jobs.length, newCount, updatedCount);
  return { newCount, updatedCount };
}

async function logScrapeResult(source: string, found: number, newCount: number, updated: number) {
  await prisma.systemLog.create({
    data: {
      type: "scrape",
      source,
      message: `${source}: ${found} found, ${newCount} new, ${updated} updated`,
      metadata: { found, new: newCount, updated },
    },
  }).catch((e) => console.warn(`[${source}] Failed to log scrape result:`, e));
}
