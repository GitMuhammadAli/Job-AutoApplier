/**
 * Debug script: for a given userId, show settings (preferredPlatforms, city, country)
 * and UserJob counts by source. Run: npx tsx src/scripts/debug-user-jobs.ts <userId>
 * Or set USER_ID in env. Uses DATABASE_URL from .env.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2] || process.env.USER_ID;
  if (!userId) {
    console.error("Usage: npx tsx src/scripts/debug-user-jobs.ts <userId>");
    console.error("Or set USER_ID in env.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    console.error("User not found:", userId);
    process.exit(1);
  }
  console.log("User:", user.id, user.email, user.name ?? "(no name)");
  console.log("");

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      preferredPlatforms: true,
      city: true,
      country: true,
      keywords: true,
      isOnboarded: true,
    },
  });
  if (!settings) {
    console.error("No settings found for user.");
    process.exit(1);
  }
  console.log("Settings:");
  console.log("  preferredPlatforms:", settings.preferredPlatforms?.length ?? 0, settings.preferredPlatforms ?? []);
  console.log("  city:", settings.city ?? "(not set)");
  console.log("  country:", settings.country ?? "(not set)");
  console.log("  keywords count:", settings.keywords?.length ?? 0);
  console.log("  isOnboarded:", settings.isOnboarded);
  console.log("");

  const userJobs = await prisma.userJob.findMany({
    where: { userId, isDismissed: false },
    include: {
      globalJob: {
        select: { id: true, title: true, company: true, location: true, source: true },
      },
    },
    orderBy: { matchScore: "desc" },
    take: 2000,
  });

  const bySource = new Map<string, number>();
  for (const uj of userJobs) {
    const src = uj.globalJob?.source ?? "unknown";
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
  }
  console.log("UserJob count by source (raw, isDismissed=false):");
  const sorted = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]);
  for (const [source, count] of sorted) {
    console.log(`  ${source}: ${count}`);
  }
  console.log("  TOTAL:", userJobs.length);
  console.log("");

  // GlobalJob pool (last 7 days) — shows whether scrapers are adding jobs from other sources
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const globalBySource = await prisma.globalJob.groupBy({
    by: ["source"],
    where: { isActive: true, createdAt: { gte: sevenDaysAgo } },
    _count: { id: true },
  });
  const globalTotal = globalBySource.reduce((s, r) => s + r._count.id, 0);
  console.log("GlobalJob pool (last 7 days, isActive=true) by source:");
  globalBySource
    .sort((a, b) => b._count.id - a._count.id)
    .forEach((r) => console.log(`  ${r.source}: ${r._count.id}`));
  console.log("  TOTAL in pool:", globalTotal);
  console.log("");

  const platformsLower = (settings.preferredPlatforms ?? []).map((p) => (p || "").toLowerCase().trim()).filter(Boolean);
  const city = (settings.city ?? "").trim().toLowerCase();
  const country = (settings.country ?? "").trim().toLowerCase();

  const afterPlatformFilter = userJobs.filter((uj) => {
    const src = (uj.globalJob?.source ?? "").toLowerCase().trim();
    if (platformsLower.length === 0) return true;
    if (!src) return true;
    return platformsLower.includes(src);
  });
  const afterLocationFilter = afterPlatformFilter.filter((uj) => {
    const loc = (uj.globalJob?.location ?? "").toLowerCase();
    if (city) {
      if (!loc) return true;
      if (/remote|anywhere|worldwide|global/.test(loc)) return true;
      const cityPart = city.split(",")[0]?.trim() ?? "";
      return cityPart ? loc.includes(cityPart) : true;
    }
    if (country) {
      if (!loc) return true;
      if (/remote|anywhere|worldwide|global/.test(loc)) return true;
      return loc.includes(country);
    }
    return true;
  });

  console.log("After applying display filters (platform + location from settings):");
  const bySourceAfter = new Map<string, number>();
  for (const uj of afterLocationFilter) {
    const src = uj.globalJob?.source ?? "unknown";
    bySourceAfter.set(src, (bySourceAfter.get(src) ?? 0) + 1);
  }
  const sortedAfter = Array.from(bySourceAfter.entries()).sort((a, b) => b[1] - a[1]);
  for (const [source, count] of sortedAfter) {
    console.log(`  ${source}: ${count}`);
  }
  console.log("  TOTAL displayed:", afterLocationFilter.length);
  console.log("");

  console.log("Sample jobs (first 5 by score):");
  for (const uj of afterLocationFilter.slice(0, 5)) {
    console.log(`  - [${uj.globalJob?.source}] ${uj.globalJob?.company} – ${uj.globalJob?.title} (${uj.globalJob?.location ?? "n/a"})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
