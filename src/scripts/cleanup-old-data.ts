/**
 * Data cleanup script — deactivates old jobs, deletes dead records, prunes logs.
 * Run: npx tsx src/scripts/cleanup-old-data.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

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

import { prisma } from "../lib/prisma";
import { STALE_DAYS, STUCK_SENDING_TIMEOUT_MS } from "../lib/constants";

async function main() {
  const now = new Date();
  console.log(`\nJobPilot Data Cleanup — ${now.toISOString()}\n`);

  // Step 1: Deactivate stale jobs (per-source thresholds)
  let totalMarkedInactive = 0;
  for (const [source, days] of Object.entries(STALE_DAYS)) {
    if (source === "default") continue;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const result = await prisma.globalJob.updateMany({
      where: { source, lastSeenAt: { lt: cutoff }, isActive: true },
      data: { isActive: false },
    });
    if (result.count > 0) {
      console.log(`  Deactivated ${result.count} stale ${source} jobs (>${days}d old)`);
      totalMarkedInactive += result.count;
    }
  }
  console.log(`Step 1: Deactivated ${totalMarkedInactive} stale jobs total`);

  // Step 2: Delete very old inactive jobs (90 days, no UserJob references)
  const oldCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const deadJobs = await prisma.globalJob.findMany({
    where: {
      isActive: false,
      createdAt: { lt: oldCutoff },
      userJobs: { none: {} },
    },
    select: { id: true },
    take: 5000,
  });
  let deletedJobs = 0;
  if (deadJobs.length > 0) {
    const result = await prisma.globalJob.deleteMany({
      where: { id: { in: deadJobs.map((j) => j.id) } },
    });
    deletedJobs = result.count;
  }
  console.log(`Step 2: Deleted ${deletedJobs} old inactive jobs (>90d, no references)`);

  // Step 3: Prune old SystemLog entries (>30 days)
  const logCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prunedLogs = await prisma.systemLog.deleteMany({
    where: { createdAt: { lt: logCutoff } },
  });
  console.log(`Step 3: Pruned ${prunedLogs.count} old system logs (>30d)`);

  // Step 4: Prune old ScraperRun records (>30 days)
  let prunedRuns = 0;
  try {
    const runResult = await prisma.scraperRun.deleteMany({
      where: { startedAt: { lt: logCutoff } },
    });
    prunedRuns = runResult.count;
  } catch {
    // table may not exist yet
  }
  console.log(`Step 4: Pruned ${prunedRuns} old scraper run records (>30d)`);

  // Step 5: Recover stuck SENDING applications
  const stuckCutoff = new Date(Date.now() - STUCK_SENDING_TIMEOUT_MS);
  const stuckRecovered = await prisma.jobApplication.updateMany({
    where: { status: "SENDING", updatedAt: { lt: stuckCutoff } },
    data: { status: "FAILED", errorMessage: "Stuck in SENDING state — recovered by cleanup" },
  });
  console.log(`Step 5: Recovered ${stuckRecovered.count} stuck SENDING applications`);

  // Summary
  const finalCount = await prisma.globalJob.count();
  const activeCount = await prisma.globalJob.count({ where: { isActive: true } });
  console.log(`\nDone. ${finalCount.toLocaleString()} total jobs, ${activeCount.toLocaleString()} active.\n`);
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch(() => {});
  });
