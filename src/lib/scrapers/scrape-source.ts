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
  let newCount = 0;
  let updatedCount = 0;

  const jobs = await scraperFn(queries);

  for (const job of jobs) {
    try {
      job.description = sanitizeScrapedText(job.description);
      job.title = sanitizeScrapedText(job.title) || job.title;
      job.company = sanitizeScrapedText(job.company) || job.company;
      job.location = sanitizeScrapedText(job.location, false) || job.location;
      job.salary = sanitizeScrapedText(job.salary, false) || job.salary;

      if (!job.category) {
        job.category = categorizeJob(job.title, job.skills || [], job.description || "");
      }

      const existing = await prisma.globalJob.findUnique({
        where: { sourceId_source: { sourceId: job.sourceId, source: job.source } },
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
            ...(job.companyEmail ? { companyEmail: job.companyEmail } : {}),
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
    } catch (err) {
      console.warn(`[${sourceName}] Upsert failed for "${job.title}":`, err);
    }
  }

  await prisma.systemLog.create({
    data: {
      type: "scrape",
      source: sourceName,
      message: `${sourceName}: ${jobs.length} found, ${newCount} new, ${updatedCount} updated`,
      metadata: { found: jobs.length, new: newCount, updated: updatedCount },
    },
  });

  return { newCount, updatedCount };
}
