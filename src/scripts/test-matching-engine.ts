/**
 * Standalone test: Job matching engine for JobPilot.
 *
 * Run:  npx tsx src/scripts/test-matching-engine.ts <userId>
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
  getUserId,
  GREEN,
  RED,
  CYAN,
  BOLD,
  DIM,
  RESET,
} from "./test-utils";
import { computeMatchScore, MATCH_THRESHOLDS } from "@/lib/matching/score-engine";
import { decryptSettingsFields } from "@/lib/encryption";

const BOX_TOP_LEFT = "┌";
const BOX_TOP_RIGHT = "┐";
const BOX_BOTTOM_LEFT = "└";
const BOX_BOTTOM_RIGHT = "┘";
const BOX_H = "─";
const BOX_V = "│";

async function main() {
  const userId = getUserId();
  const elapsed = timer();

  header("Job Matching Engine Test");
  info(`User ID: ${userId}`);

  // ─── 1. Load user settings & decrypt ─────────────────────────────────────
  subheader("1. Load user settings");
  const rawSettings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!rawSettings) {
    fail(`No UserSettings found for userId: ${userId}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  const settings = decryptSettingsFields(rawSettings);
  const keywords = (settings.keywords as string[]) ?? [];
  const preferredCategories = (settings.preferredCategories as string[]) ?? [];
  const preferredPlatforms = (settings.preferredPlatforms as string[]) ?? [];
  const city = settings.city ?? null;
  const country = settings.country ?? null;
  const experienceLevel = settings.experienceLevel ?? null;
  const workType = (settings.workType as string[]) ?? [];
  const jobType = (settings.jobType as string[]) ?? [];

  pass(`Settings loaded: ${keywords.length} keywords, ${preferredCategories.length} categories, ${preferredPlatforms.length} platforms`);
  info(`Location: ${city || "(not set)"} / ${country || "(not set)"}`);

  // ─── 2. Load resumes ─────────────────────────────────────────────────────
  subheader("2. Load resumes");
  const resumes = await prisma.resume.findMany({
    where: { userId, isDeleted: false },
    select: { id: true, name: true, content: true },
    take: 50,
  });
  const resumePayload = resumes.map((r) => ({
    id: r.id,
    name: r.name,
    content: r.content,
  }));
  pass(`Loaded ${resumes.length} resume(s)`);

  // ─── 3. Load recent GlobalJobs ───────────────────────────────────────────
  subheader("3. Load recent GlobalJobs");
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.globalJob.findMany({
    where: { isActive: true, createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  pass(`Loaded ${jobs.length} jobs (last 7 days, isActive=true)`);

  const settingsForMatch = {
    keywords,
    preferredCategories,
    preferredPlatforms,
    city,
    country,
    experienceLevel,
    workType,
    jobType,
    salaryMin: settings.salaryMin ?? null,
    salaryMax: settings.salaryMax ?? null,
  };

  // ─── 4. Run computeMatchScore for each job ───────────────────────────────
  subheader("4. Match all jobs");
  const rejectionReasons: Record<string, number> = {};
  const scoreCounts: Record<string, number> = {};
  for (let i = 0; i <= 10; i++) scoreCounts[`${i * 10}-${i * 10 + 9}`] = 0;
  scoreCounts["90-100"] = 0;

  const scoredJobs: Array<{
    job: (typeof jobs)[0];
    score: number;
    reasons: string[];
  }> = [];

  for (const job of jobs) {
    const jobPayload = {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      skills: (job.skills as string[]) ?? [],
      category: job.category,
      postedDate: job.postedDate,
      source: job.source,
      experienceLevel: job.experienceLevel,
      salary: job.salary,
      jobType: job.jobType,
      isFresh: job.isFresh,
      firstSeenAt: job.firstSeenAt,
    };

    const result = computeMatchScore(jobPayload, settingsForMatch, resumePayload);

    if (result.score === 0 && result.reasons.length > 0) {
      const reason = result.reasons[0];
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    } else if (result.score > 0) {
      scoredJobs.push({ job, score: result.score, reasons: result.reasons });
      const bucket = result.score >= 90 ? "90-100" : `${Math.floor(result.score / 10) * 10}-${Math.floor(result.score / 10) * 10 + 9}`;
      scoreCounts[bucket] = (scoreCounts[bucket] ?? 0) + 1;
    }
  }

  const matchTime = elapsed();
  pass(`Matched ${jobs.length} jobs in ${matchTime}`);

  // ─── 5. Filter results breakdown ─────────────────────────────────────────
  subheader("5. Filter results breakdown");
  const passed = scoredJobs.length;
  const rejected = jobs.length - passed;
  const widths = [28, 8];
  console.log(`  ${BOX_TOP_LEFT}${BOX_H.repeat(28)}${"┬"}${BOX_H.repeat(8)}${BOX_TOP_RIGHT}`);
  console.log(`  ${BOX_V}${"Metric".padEnd(28)}${BOX_V}${"Count".padEnd(8)}${BOX_V}`);
  console.log(`  ${"├" + BOX_H.repeat(28) + "┼" + BOX_H.repeat(8) + "┤"}`);
  console.log(`  ${BOX_V}${"Passed (scored > 0)".padEnd(28)}${BOX_V}${String(passed).padEnd(8)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Rejected (score = 0)".padEnd(28)}${BOX_V}${String(rejected).padEnd(8)}${BOX_V}`);
  console.log(`  ${BOX_BOTTOM_LEFT}${BOX_H.repeat(28)}${"┴"}${BOX_H.repeat(8)}${BOX_BOTTOM_RIGHT}`);

  if (Object.keys(rejectionReasons).length > 0) {
    console.log(`\n  ${BOLD}Rejection reasons:${RESET}`);
    for (const [reason, count] of Object.entries(rejectionReasons).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${DIM}•${RESET} ${reason}: ${count}`);
    }
  }

  // ─── 6. Score distribution histogram ────────────────────────────────────
  subheader("6. Score distribution");
  const buckets = ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80-89", "90-100"];
  const maxCount = Math.max(...buckets.map((b) => scoreCounts[b] ?? 0), 1);
  const barWidth = 30;

  for (const bucket of buckets) {
    const count = scoreCounts[bucket] ?? 0;
    const barLen = maxCount > 0 ? Math.round((count / maxCount) * barWidth) : 0;
    const bar = "█".repeat(barLen) + "░".repeat(barWidth - barLen);
    const threshold =
      bucket === "40-49"
        ? ` ≥KANBAN`
        : bucket === "50-59"
          ? ` ≥NOTIFY`
          : bucket === "60-69"
            ? ` ≥AUTO_DRAFT`
            : bucket === "70-79"
              ? ` ≥AUTO_SEND`
              : "";
    console.log(`  ${bucket.padStart(6)} │ ${CYAN}${bar}${RESET} ${count}${threshold}`);
  }

  // ─── 7. Top 10 matched jobs ──────────────────────────────────────────────
  subheader("7. Top 10 matched jobs");
  const top10 = [...scoredJobs].sort((a, b) => b.score - a.score).slice(0, 10);
  if (top10.length === 0) {
    warn("No jobs passed the match filters.");
  } else {
    const colWidths = [6, 36, 18, 8, 32];
    console.log(`  ${BOX_TOP_LEFT}${colWidths.map((w) => BOX_H.repeat(w)).join("┬")}${BOX_TOP_RIGHT}`);
    console.log(`  ${BOX_V}${"#".padEnd(6)}${BOX_V}${"Title".padEnd(36)}${BOX_V}${"Company".padEnd(18)}${BOX_V}${"Score".padEnd(8)}${BOX_V}${"Reasons".padEnd(32)}${BOX_V}`);
    console.log(`  ${"├" + colWidths.map((w) => BOX_H.repeat(w)).join("┼") + "┤"}`);
    top10.forEach(({ job, score, reasons }, i) => {
      const title = (job.title.length > 34 ? job.title.slice(0, 31) + "..." : job.title).padEnd(36);
      const company = (job.company.length > 16 ? job.company.slice(0, 13) + "..." : job.company).padEnd(18);
      const scoreColor = score >= MATCH_THRESHOLDS.AUTO_SEND ? GREEN : score >= MATCH_THRESHOLDS.NOTIFY ? CYAN : RESET;
      const reasonStr = (reasons[0] ?? "").slice(0, 30).padEnd(32);
      console.log(`  ${BOX_V}${String(i + 1).padEnd(6)}${BOX_V}${title}${BOX_V}${company}${BOX_V}${scoreColor}${String(score).padEnd(8)}${RESET}${BOX_V}${DIM}${reasonStr}${RESET}${BOX_V}`);
    });
    console.log(`  ${BOX_BOTTOM_LEFT}${colWidths.map((w) => BOX_H.repeat(w)).join("┴")}${BOX_BOTTOM_RIGHT}`);
  }

  // ─── 8. Edge case tests ──────────────────────────────────────────────────
  subheader("8. Edge case tests");
  const jobSource = (preferredPlatforms[0] || "linkedin").toLowerCase();
  const edgeCases = [
    {
      name: "Job with null description",
      job: {
        title: "Senior React Developer",
        company: "Test Co",
        location: "Remote",
        description: null,
        skills: ["React", "TypeScript"],
        category: "Software Engineering",
        postedDate: null,
        source: jobSource,
        experienceLevel: "senior",
        salary: null,
        jobType: null,
        isFresh: false,
        firstSeenAt: new Date(),
      },
    },
    {
      name: "Job with null/empty skills array",
      job: {
        title: "Full Stack Engineer",
        company: "Test Co",
        location: "Remote",
        description: "We need React and Node.js",
        skills: [] as string[],
        category: "Software Engineering",
        postedDate: null,
        source: jobSource,
        experienceLevel: "mid",
        salary: null,
        jobType: null,
        isFresh: false,
        firstSeenAt: new Date(),
      },
    },
    {
      name: "Job with no location",
      job: {
        title: "Backend Developer",
        company: "Test Co",
        location: null,
        description: "Python and Django",
        skills: ["Python", "Django"],
        category: "Software Engineering",
        postedDate: null,
        source: jobSource,
        experienceLevel: "mid",
        salary: null,
        jobType: null,
        isFresh: false,
        firstSeenAt: new Date(),
      },
    },
    {
      name: "Job title exactly matches keyword",
      job: {
        title: keywords[0] || "React Developer",
        company: "Test Co",
        location: "Remote",
        description: "Great role",
        skills: ["React"],
        category: "Software Engineering",
        postedDate: null,
        source: jobSource,
        experienceLevel: "mid",
        salary: null,
        jobType: null,
        isFresh: false,
        firstSeenAt: new Date(),
      },
    },
  ];

  let edgePass = 0;
  let edgeFail = 0;
  for (const { name, job } of edgeCases) {
    try {
      const result = computeMatchScore(job, settingsForMatch, resumePayload);
      if (result.score >= 0 && result.score <= 100) {
        pass(`${name}: score=${result.score} (no crash)`);
        edgePass++;
      } else {
        fail(`${name}: score=${result.score} (expected 0-100)`);
        edgeFail++;
      }
    } catch (e: unknown) {
      fail(`${name}: ${e instanceof Error ? e.message : String(e)}`);
      edgeFail++;
    }
  }

  // ─── 9. Score cap check ──────────────────────────────────────────────────
  subheader("9. Score cap check (score ≤ 100)");
  const over100 = scoredJobs.filter((j) => j.score > 100);
  if (over100.length > 0) {
    fail(`${over100.length} job(s) have score > 100`);
  } else {
    pass("All scores are ≤ 100");
  }

  // ─── 10. Verdict ────────────────────────────────────────────────────────
  const allEdgePass = edgeFail === 0;
  const noOverflow = over100.length === 0;
  const hasMatches = scoredJobs.length > 0 || jobs.length === 0;

  verdict("Verdict");
  if (allEdgePass && noOverflow) {
    pass("Edge cases passed, score cap respected");
  }
  if (!allEdgePass) {
    fail("Some edge cases failed");
  }
  if (!noOverflow) {
    fail("Score overflow detected");
  }
  if (hasMatches || jobs.length === 0) {
    info(`Processed ${jobs.length} jobs, ${scoredJobs.length} passed filters`);
  }

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
