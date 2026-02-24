/**
 * Test the query-time recommendation engine.
 *
 * Run:  npx tsx src/scripts/test-recommendation-engine.ts <userId>
 *
 * Requires: DATABASE_URL in .env
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env
try {
  const envPath = resolve(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("Warning: Could not load .env file");
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx tsx src/scripts/test-recommendation-engine.ts <userId>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      keywords: true,
      city: true,
      country: true,
      preferredPlatforms: true,
      experienceLevel: true,
      preferredCategories: true,
    },
  });

  console.log("\n" + "═".repeat(60));
  console.log("  RECOMMENDATION ENGINE TEST — " + user.email);
  console.log("═".repeat(60));
  console.log(`\nUser profile:`);
  console.log(`  Keywords: ${(settings?.keywords ?? []).join(", ") || "(none)"}`);
  console.log(`  City: ${settings?.city || "(not set)"}`);
  console.log(`  Country: ${settings?.country || "(not set)"}`);
  console.log(`  Platforms: ${(settings?.preferredPlatforms ?? []).join(", ") || "all"}`);
  console.log(`  Experience: ${settings?.experienceLevel || "(not set)"}`);
  console.log(`  Categories: ${(settings?.preferredCategories ?? []).join(", ") || "(none)"}`);

  // Dynamic import to use the project's prisma instance via module resolution
  const { getRecommendedJobs } = await import("../lib/matching/recommendation-engine");

  // ── Default run ──
  console.log("\n" + "─".repeat(60));
  console.log("  DEFAULT RUN (sort by score, page 1, 50 results)");
  console.log("─".repeat(60));

  const result = await getRecommendedJobs(userId, { pageSize: 200 });

  console.log(`\nTiming:`);
  console.log(`  SQL query:         ${result.timing.sqlMs}ms (${result.filterBreakdown.sqlCandidates} candidates loaded)`);
  console.log(`  Hard filters:      ${result.timing.filterMs}ms (→ ${result.filterBreakdown.afterLocation} passed location, → ${result.filterBreakdown.afterKeywords} passed keywords)`);
  console.log(`  Scoring:           ${result.timing.scoreMs}ms (${result.filterBreakdown.afterKeywords} jobs scored)`);
  console.log(`  Total:             ${result.timing.totalMs}ms ${result.timing.totalMs < 500 ? "✅" : result.timing.totalMs < 1000 ? "⚠️" : "❌"}`);

  console.log(`\nPipeline:`);
  console.log(`  After SQL filter:  ${result.filterBreakdown.sqlCandidates}`);
  console.log(`  After location:    ${result.filterBreakdown.afterLocation}`);
  console.log(`  After keywords:    ${result.filterBreakdown.afterKeywords}`);
  console.log(`  After dedup:       ${result.filterBreakdown.afterDedup}`);
  console.log(`  FINAL:             ${result.total} recommended jobs`);

  // Score distribution
  const buckets = { "80-100": 0, "60-79": 0, "40-59": 0, "20-39": 0, "0-19": 0 };
  for (const j of result.jobs) {
    if (j.matchScore >= 80) buckets["80-100"]++;
    else if (j.matchScore >= 60) buckets["60-79"]++;
    else if (j.matchScore >= 40) buckets["40-59"]++;
    else if (j.matchScore >= 20) buckets["20-39"]++;
    else buckets["0-19"]++;
  }

  console.log(`\nScore distribution:`);
  const maxBar = Math.max(...Object.values(buckets), 1);
  for (const [range, count] of Object.entries(buckets)) {
    const bar = "█".repeat(Math.ceil((count / maxBar) * 30));
    console.log(`  ${range}: ${bar} ${count} jobs`);
  }

  // Source breakdown
  console.log(`\nSource breakdown:`);
  const sortedSources = Object.entries(result.sourceCounts).sort((a, b) => b[1] - a[1]);
  for (const [source, count] of sortedSources) {
    console.log(`  ${source}: ${count}`);
  }

  // Top 5
  console.log(`\nTop 5:`);
  for (const j of result.jobs.slice(0, 5)) {
    const badge = j.matchScore >= 80 ? "🟢" : j.matchScore >= 60 ? "🔵" : j.matchScore >= 40 ? "🟡" : "🟠";
    console.log(`  ${badge} [${j.matchScore}%] ${j.title} — ${j.company} (${j.location || "N/A"})`);
    console.log(`        Keywords: ${j.keywordsMatched.slice(0, 5).join(", ")}`);
    console.log(`        Reasons: ${j.matchReasons.slice(0, 3).join(" · ")}`);
    if (j.companyEmail) console.log(`        ✉️ ${j.companyEmail}`);
    if (j.userJobStage) console.log(`        Stage: ${j.userJobStage}`);
    console.log();
  }

  // Keyword coverage
  const kwCounts: Record<string, number> = {};
  for (const j of result.jobs) {
    for (const kw of j.keywordsMatched) {
      kwCounts[kw] = (kwCounts[kw] || 0) + 1;
    }
  }
  const kwSorted = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]);
  console.log(`Keywords that matched most:`);
  for (const [kw, count] of kwSorted.slice(0, 10)) {
    console.log(`  ${kw}: ${count} jobs`);
  }

  const allKw = (settings?.keywords ?? []).map((k) => k.toLowerCase());
  const zeroMatch = allKw.filter((k) => !kwCounts[k]);
  if (zeroMatch.length > 0) {
    console.log(`\nKeywords that matched ZERO jobs:`);
    for (const kw of zeroMatch) {
      console.log(`  ${kw}: 0`);
    }
  }

  // Auto-apply simulation
  const autoApplyCount = result.jobs.filter((j) => j.matchScore >= 70 && j.companyEmail).length;
  console.log(`\nAuto-apply simulation (score ≥ 70 + has email):`);
  console.log(`  ${autoApplyCount} jobs would qualify`);

  // ── Compare with old system ──
  console.log("\n" + "─".repeat(60));
  console.log("  COMPARISON WITH OLD SYSTEM (UserJob-based)");
  console.log("─".repeat(60));

  const oldCount = await prisma.userJob.count({
    where: { userId, isDismissed: false },
  });

  console.log(`  Old system (UserJob): ${oldCount} displayed jobs`);
  console.log(`  New system (query-time): ${result.total} recommended jobs`);
  const diff = result.total - oldCount;
  console.log(`  Difference: ${diff > 0 ? "+" : ""}${diff} jobs`);

  // ── Search test ──
  if ((settings?.keywords ?? []).length > 0) {
    const searchTerm = settings!.keywords[0];
    console.log(`\nSearch test ("${searchTerm}"):`);
    const searchResult = await getRecommendedJobs(userId, { searchQuery: searchTerm, pageSize: 200 });
    console.log(`  Found ${searchResult.total} jobs matching "${searchTerm}"`);
  }

  console.log("\n" + "═".repeat(60));
  console.log("  TEST COMPLETE");
  console.log("═".repeat(60) + "\n");
}

main()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
