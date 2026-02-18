import { prisma } from "@/lib/prisma";
import type { ScrapedJob, SearchQuery } from "@/types";
import { categorizeJob } from "@/lib/job-categorizer";

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
    } catch {
      // skip individual upsert failures
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
