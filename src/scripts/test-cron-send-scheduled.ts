/**
 * Standalone test: Simulates the send-scheduled cron.
 *
 * Run:  npx tsx src/scripts/test-cron-send-scheduled.ts [--dry-run]
 *       npx tsx src/scripts/test-cron-send-scheduled.ts --live
 *
 * Default: dry-run (no actual sending). Use --live to actually attempt sending.
 *
 * Requires: DATABASE_URL, ENCRYPTION_KEY
 */

import "./test-utils";
import { prisma } from "@/lib/prisma";
import {
  header,
  subheader,
  verdict,
  pass,
  fail,
  warn,
  info,
  timer,
} from "./test-utils";
import { canSendNow } from "@/lib/send-limiter";
import { decryptSettingsFields } from "@/lib/encryption";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--live");

  const t = timer();

  header("Send-Scheduled Cron Simulation");
  info(`Mode: ${dryRun ? "DRY-RUN (no actual sending)" : "LIVE (will attempt sending)"}`);

  // ─── 1. Find READY applications (scheduledSendAt <= now) ─────────────────
  subheader("1. READY applications (scheduledSendAt <= now)");
  const readyApps = await prisma.jobApplication.findMany({
    where: {
      status: "READY",
      scheduledSendAt: { not: null, lte: new Date() },
    },
    include: {
      userJob: { include: { globalJob: true } },
      user: true,
    },
    orderBy: { scheduledSendAt: "asc" },
    take: 20,
  });

  info(`Found ${readyApps.length} READY application(s)`);

  let wouldSend = 0;
  let wouldSkip = 0;
  let wouldDraft = 0;

  for (let i = 0; i < readyApps.length; i++) {
    const app = readyApps[i];
    const job = app.userJob?.globalJob;
    const jobTitle = job?.title ?? "(no job)";
    const company = job?.company ?? "(no company)";
    const recipientEmail = app.recipientEmail?.trim() || null;

    console.log(`\n  [${i + 1}/${readyApps.length}] ${jobTitle} @ ${company}`);
    info(`    Recipient: ${recipientEmail ?? "(not set)"}`);
    info(`    App ID: ${app.id}`);

    // How overdue
    const scheduledAt = app.scheduledSendAt!;
    const now = new Date();
    const overdueMs = now.getTime() - scheduledAt.getTime();
    const overdueMins = Math.floor(overdueMs / 60000);
    if (overdueMins > 0) {
      warn(`    Overdue: ${overdueMins} minute(s)`);
    } else {
      info(`    Scheduled: now (on time)`);
    }

    // canSendNow checks
    const limitCheck = await canSendNow(app.userId);
    if (limitCheck.allowed) {
      pass(`    canSendNow: allowed`);
      if (limitCheck.stats) {
        info(`      Stats: today=${limitCheck.stats.todayCount}/${limitCheck.stats.maxPerDay}, hour=${limitCheck.stats.hourCount}/${limitCheck.stats.maxPerHour}`);
      }
    } else {
      fail(`    canSendNow: ${limitCheck.reason ?? "blocked"}`);
      if (limitCheck.waitSeconds) {
        info(`      Wait: ${limitCheck.waitSeconds}s`);
      }
    }

    // recipientEmail check
    if (!recipientEmail) {
      warn(`    No recipient email → would fall back to DRAFT`);
      wouldDraft++;
    } else if (!limitCheck.allowed) {
      wouldSkip++;
    } else {
      wouldSend++;
    }

    // Atomic claim (dry-run: show what would happen)
    const claimable = app.status === "READY" || app.status === "DRAFT";
    if (dryRun) {
      info(`    Atomic claim: would ${claimable ? "claim (READY→SENDING)" : "skip (already SENDING/SENT)"}`);
    } else if (claimable && recipientEmail && limitCheck.allowed) {
      // In live mode we don't actually do the claim here - sendApplication does it
      info(`    Would run sendApplication (handles atomic claim)`);
    }
  }

  // ─── 2. Find STUCK applications (SENDING > 10 min) ────────────────────────
  subheader("2. STUCK applications (SENDING > 10 min)");
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const stuckApps = await prisma.jobApplication.findMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: tenMinutesAgo },
    },
    include: {
      userJob: { include: { globalJob: true } },
    },
  });

  info(`Found ${stuckApps.length} STUCK application(s)`);
  for (const app of stuckApps) {
    const job = app.userJob?.globalJob;
    const stuckMins = Math.floor((Date.now() - app.updatedAt.getTime()) / 60000);
    warn(`  ${job?.title ?? app.id} @ ${job?.company ?? "?"} — stuck ${stuckMins}m (id: ${app.id})`);
  }

  // ─── 3. Summary ──────────────────────────────────────────────────────────
  subheader("3. Summary");
  console.log(`  Would send:     ${wouldSend}`);
  console.log(`  Would skip:     ${wouldSkip} (paused/limit)`);
  console.log(`  Would draft:    ${wouldDraft} (no recipient email)`);
  console.log(`  Stuck count:    ${stuckApps.length}`);
  info(`Elapsed: ${t()}`);

  // ─── 4. Verdict ──────────────────────────────────────────────────────────
  verdict("Verdict");
  if (dryRun) {
    pass("Dry-run complete — no actual sending performed");
  } else {
    if (wouldSend > 0) {
      warn(`--live specified: ${wouldSend} app(s) would be sent (not implemented in this test script)`);
    } else {
      pass("No applications eligible for sending");
    }
  }
  if (stuckApps.length > 0) {
    warn(`${stuckApps.length} stuck SENDING application(s) may need manual recovery`);
  }
  info(`Processed ${readyApps.length} READY, ${stuckApps.length} STUCK`);

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
