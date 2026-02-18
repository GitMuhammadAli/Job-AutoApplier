import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateSearchQueries } from "@/lib/scrapers/keyword-aggregator";
import { getPaidSourcesToday, getPriorityPlatforms } from "@/lib/scrapers/source-rotation";
import { scrapeAllSourcesGlobal } from "@/lib/scrapers";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
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
          "indeed", "remotive", "arbeitnow", "linkedin", "rozee",
          ...getPaidSourcesToday(),
        ];
        // Deduplicate in case paid sources overlap
        sources = sources.filter((s, i) => sources.indexOf(s) === i);
    }

    if (sources.length === 0) {
      return NextResponse.json({ message: "No sources to scrape", mode });
    }

    const queries = await aggregateSearchQueries();
    if (queries.length === 0) {
      return NextResponse.json({ message: "No user keywords configured", mode, scraped: 0 });
    }

    const { jobs, stats } = await scrapeAllSourcesGlobal(queries, sources);

    let newCount = 0;
    let updatedCount = 0;

    for (const job of jobs) {
      try {
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
        // Skip individual upsert failures
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      sources,
      stats,
      totalScraped: jobs.length,
      new: newCount,
      updated: updatedCount,
    });
  } catch (error) {
    console.error("Scrape global error:", error);
    return NextResponse.json(
      { error: "Scrape failed", details: String(error) },
      { status: 500 }
    );
  }
}
