import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNewJobAlert } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const RESUME_KEYWORD_MAP: Record<string, string[]> = {
  "Full-Stack": ["full stack", "fullstack", "mern"],
  Backend: ["backend", "node", "nestjs", "express", "api"],
  Frontend: ["frontend", "react", "vue", "angular", "ui"],
  MERN: ["mern", "mongodb", "express", "react", "node"],
  TypeScript: ["typescript", "ts"],
  JavaScript: ["javascript", "js"],
};

function recommendResume(jobTitle: string, jobDesc: string): string {
  const text = (jobTitle + " " + jobDesc).toLowerCase();
  for (const [resumeName, kws] of Object.entries(RESUME_KEYWORD_MAP)) {
    if (kws.some((kw) => text.includes(kw))) {
      return resumeName;
    }
  }
  return "General";
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user settings for search config
    const user = await prisma.user.findUnique({
      where: { email: "ali@demo.com" },
      include: { settings: true, resumes: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const keywords = user.settings?.searchKeywords?.split(",").map((k) => k.trim()) ?? [
      "MERN", "NestJS", "Next.js", "React", "Node.js",
    ];
    const location = user.settings?.searchLocation ?? "Lahore";

    // Build RSS feed URLs for Indeed
    const feeds = keywords.slice(0, 5).map((kw) => {
      const q = encodeURIComponent(kw.toLowerCase() + " developer");
      const l = encodeURIComponent(location);
      return `https://pk.indeed.com/rss?q=${q}&l=${l}&sort=date`;
    });

    // Fetch all RSS feeds
    const allJobs: Array<{
      company: string;
      role: string;
      url: string;
      platform: string;
      location: string;
      notes: string;
    }> = [];

    for (const feedUrl of feeds) {
      try {
        const res = await fetch(feedUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (JobPilot RSS Reader)" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) continue;
        const xml = await res.text();

        // Parse RSS items
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
          const content = match[1];
          const title = content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/);
          const link = content.match(/<link>([\s\S]*?)<\/link>/);
          const desc = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/);
          const source = content.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/);

          const role = (title?.[1] || title?.[2] || "").replace(/<[^>]*>/g, "").trim();
          const url = (link?.[1] || "").trim();
          const description = (desc?.[1] || desc?.[2] || "").replace(/<[^>]*>/g, "").substring(0, 500);
          const company = (source?.[1] || "Unknown").replace(/<[^>]*>/g, "").trim();

          if (role && url) {
            allJobs.push({
              company,
              role,
              url,
              platform: "INDEED",
              location,
              notes: description,
            });
          }
        }
      } catch {
        // Skip failed feeds
      }
    }

    // Deduplicate by URL
    const uniqueJobs = Array.from(new Map(allJobs.map((j) => [j.url, j])).values());

    // Check which URLs already exist in DB
    const existingUrls = new Set(
      (
        await prisma.job.findMany({
          where: { userId: user.id, url: { in: uniqueJobs.map((j) => j.url) } },
          select: { url: true },
        })
      ).map((j) => j.url)
    );

    const newJobs = uniqueJobs.filter((j) => !existingUrls.has(j.url));

    if (newJobs.length === 0) {
      return NextResponse.json({ message: "No new jobs found", scraped: uniqueJobs.length });
    }

    // Save new jobs to DB
    const savedJobs = [];
    for (const job of newJobs.slice(0, 20)) {
      const recommended = recommendResume(job.role, job.notes);
      const resume = user.resumes.find((r) => r.name === recommended);

      const created = await prisma.job.create({
        data: {
          company: job.company,
          role: job.role,
          url: job.url,
          platform: "INDEED",
          stage: "SAVED",
          location: job.location,
          notes: job.notes,
          resumeId: resume?.id ?? null,
          userId: user.id,
        },
      });

      await prisma.activity.create({
        data: {
          jobId: created.id,
          type: "job_created",
          toStage: "SAVED",
          note: "Auto-scraped from Indeed RSS",
          metadata: { automated: true },
        },
      });

      savedJobs.push({ ...job, recommendedResume: recommended });
    }

    // Send email notification
    if (user.settings?.emailNotifications !== false) {
      await sendNewJobAlert(savedJobs);
    }

    return NextResponse.json({
      message: `Saved ${savedJobs.length} new jobs`,
      scraped: uniqueJobs.length,
      saved: savedJobs.length,
    });
  } catch (err: any) {
    console.error("Scrape cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
