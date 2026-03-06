import { prisma } from "@/lib/prisma";
import type { ScrapedJob, SearchQuery } from "@/types";
import { categorizeJob } from "@/lib/job-categorizer";
import { extractEmailFromText } from "@/lib/extract-email-from-text";

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
    await logScrapeDetail(sourceName, 0, 0, 0, 0, queries.map((q) => q.keyword).filter(Boolean));
    return { newCount: 0, updatedCount: 0 };
  }

  // 1. Sanitize all jobs and extract emails from description text (CPU-only, no DB)
  const emailExtractions = new Map<string, { email: string; confidence: number; source?: string }>();
  for (const job of jobs) {
    job.description = sanitizeScrapedText(job.description);
    job.title = sanitizeScrapedText(job.title) || job.title;
    job.company = sanitizeScrapedText(job.company) || job.company;
    job.location = sanitizeScrapedText(job.location, false) || job.location;
    job.salary = sanitizeScrapedText(job.salary, false) || job.salary;
    if (!job.category) {
      job.category = categorizeJob(job.title, job.skills || [], job.description || "");
    }
    if (!job.companyEmail && job.description) {
      const extracted = extractEmailFromText(job.description);
      if (extracted.email) {
        job.companyEmail = extracted.email;
        emailExtractions.set(`${job.source}:${job.sourceId}`, { email: extracted.email, confidence: extracted.confidence });
      }
    }
    // If the scraper already provided confidence/source (e.g. hiring posts), use those
    if (job.companyEmail && job.emailConfidence && job.emailSource) {
      emailExtractions.set(`${job.source}:${job.sourceId}`, {
        email: job.companyEmail,
        confidence: job.emailConfidence,
        source: job.emailSource,
      });
    }
  }

  // 2. Single query: find which sourceIds already exist
  const sourceKeys = jobs.map((j) => ({ sourceId: j.sourceId, source: j.source }));
  const existing = await prisma.globalJob.findMany({
    where: { OR: sourceKeys.map((k) => ({ sourceId: k.sourceId, source: k.source })) },
    select: { id: true, sourceId: true, source: true, companyEmail: true, description: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.source}:${e.sourceId}`));
  const existingIdMap = new Map<string, string>(existing.map((e) => [`${e.source}:${e.sourceId}`, e.id]));
  const existingDataMap = new Map(existing.map((e) => [`${e.source}:${e.sourceId}`, e]));

  // 3. Split into new vs existing
  const newJobs = jobs.filter((j) => !existingSet.has(`${j.source}:${j.sourceId}`));
  const existingJobs = jobs.filter((j) => existingSet.has(`${j.source}:${j.sourceId}`));

  // 4. Batch create new jobs (single query)
  let newCount = 0;
  if (newJobs.length > 0) {
    const now = new Date();
    try {
      const result = await prisma.globalJob.createMany({
        data: newJobs.map((job) => {
          const extraction = emailExtractions.get(`${job.source}:${job.sourceId}`);
          return {
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
            ...(extraction ? {
              emailSource: extraction.source || "description_text",
              emailConfidence: extraction.confidence,
            } : {}),
            isActive: true,
            isFresh: true,
            firstSeenAt: now,
            lastSeenAt: now,
          };
        }),
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
          data: { lastSeenAt: new Date(), isActive: true, isFresh: true },
        });
        updatedCount = result.count;
      } catch (err) {
        console.warn(`[${sourceName}] Batch update failed:`, err);
      }
    }

    // 5b. Enrich existing jobs: backfill email from description, update longer descriptions
    for (const job of existingJobs) {
      const key = `${job.source}:${job.sourceId}`;
      const dbRecord = existingDataMap.get(key);
      const dbId = existingIdMap.get(key);
      if (!dbRecord || !dbId) continue;

      const extraction = emailExtractions.get(key);
      const hasNewEmail = extraction && !dbRecord.companyEmail;
      const hasLongerDesc = job.description &&
        job.description.length > (dbRecord.description?.length ?? 0);

      if (hasNewEmail || hasLongerDesc) {
        await prisma.globalJob.update({
          where: { id: dbId },
          data: {
            ...(hasNewEmail ? {
              companyEmail: extraction.email,
              emailSource: "description_text_rescrape",
              emailConfidence: extraction.confidence,
            } : {}),
            ...(hasLongerDesc ? { description: job.description } : {}),
          },
        }).catch((err) => console.warn(`[${sourceName}] Enrichment update failed for ${dbId}:`, err));
      }
    }
  }

  const emailsFound = jobs.filter((j) => j.companyEmail).length;
  const queryTerms = queries.map((q) => q.keyword).filter(Boolean);
  await logScrapeDetail(sourceName, jobs.length, newCount, updatedCount, emailsFound, queryTerms);
  return { newCount, updatedCount };
}

async function logScrapeDetail(
  source: string,
  found: number,
  newCount: number,
  updated: number,
  emailsFound: number,
  queriesUsed: string[],
) {
  await prisma.systemLog.create({
    data: {
      type: "scrape-detail",
      source,
      message: `${source}: ${newCount} new, ${updated} updated, ${emailsFound} emails (${found} fetched)`,
      metadata: {
        found,
        new: newCount,
        updated,
        emailsFound,
        queriesUsed: queriesUsed.slice(0, 10),
      },
    },
  }).catch((e) => console.warn(`[${source}] Failed to log scrape detail:`, e));
}
