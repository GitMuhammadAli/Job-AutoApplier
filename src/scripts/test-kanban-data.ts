/**
 * Standalone test: Kanban/dashboard data shape and quality.
 *
 * Run:  npx tsx src/scripts/test-kanban-data.ts <userId>
 *
 * Requires: DATABASE_URL
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
} from "./test-utils";

const VALID_STAGES = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"] as const;
const PAYLOAD_WARN_KB = 500;

function isStringArray(v: unknown): v is string[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => typeof x === "string");
}

async function main() {
  const userId = getUserId();
  const elapsed = timer();

  header("Kanban Data Shape & Quality Test");
  info(`User ID: ${userId}`);

  // ─── 1. Run Kanban query with timing ─────────────────────────────────────
  subheader("1. Kanban query");
  const queryElapsed = timer();
  const userJobs = await prisma.userJob.findMany({
    where: { userId, isDismissed: false },
    include: {
      globalJob: true,
      application: true,
    },
    orderBy: { matchScore: "desc" },
  });
  const queryTime = queryElapsed();
  pass(`Loaded ${userJobs.length} jobs in ${queryTime}`);

  if (userJobs.length === 0) {
    warn("No jobs to validate. Add jobs or use a different userId.");
    verdict("Verdict");
    info("Skipped validation (empty result)");
    console.log("");
    await prisma.$disconnect();
    return;
  }

  // ─── 2. Results by stage ─────────────────────────────────────────────────
  subheader("2. Count per stage");
  const stageCounts: Record<string, number> = {};
  for (const s of VALID_STAGES) stageCounts[s] = 0;
  for (const j of userJobs) {
    stageCounts[j.stage] = (stageCounts[j.stage] ?? 0) + 1;
  }
  for (const s of VALID_STAGES) {
    const count = stageCounts[s] ?? 0;
    console.log(`  ${s.padEnd(12)} ${count}`);
  }

  // ─── 3. Data shape check on first job ────────────────────────────────────
  subheader("3. Data shape check (first job)");
  const first = userJobs[0];
  const shapeIssues: string[] = [];

  const userJobFields = ["id", "userId", "globalJobId", "matchScore", "matchReasons", "stage", "isDismissed", "isBookmarked", "notes", "createdAt", "updatedAt"];
  for (const f of userJobFields) {
    if (!(f in first)) shapeIssues.push(`UserJob missing field: ${f}`);
  }

  const globalJobFields = ["id", "title", "company", "location", "description", "source", "sourceId", "sourceUrl", "applyUrl", "companyUrl", "companyEmail", "skills", "category", "salary", "jobType", "experienceLevel", "postedDate", "isActive", "isFresh", "lastSeenAt", "createdAt"];
  if (first.globalJob) {
    for (const f of globalJobFields) {
      if (!(f in first.globalJob)) shapeIssues.push(`GlobalJob missing field: ${f}`);
    }
  } else {
    shapeIssues.push("GlobalJob is null or missing");
  }

  const appFields = ["id", "userId", "userJobId", "recipientEmail", "subject", "emailBody", "coverLetter", "resumeId", "status", "scheduledSendAt", "sentAt", "errorMessage", "retryCount", "createdAt", "updatedAt"];
  if (first.application) {
    for (const f of appFields) {
      if (!(f in first.application)) shapeIssues.push(`JobApplication missing field: ${f}`);
    }
  }

  if (typeof first.matchScore !== "number" && first.matchScore !== null) {
    shapeIssues.push(`matchScore should be number | null, got ${typeof first.matchScore}`);
  }
  if (first.matchScore != null && (first.matchScore < 0 || first.matchScore > 100)) {
    shapeIssues.push(`matchScore out of range 0-100: ${first.matchScore}`);
  }

  if (!isStringArray(first.matchReasons)) {
    shapeIssues.push(`matchReasons not castable to string[]: ${typeof first.matchReasons}`);
  }

  if (first.globalJob && !isStringArray(first.globalJob.skills)) {
    shapeIssues.push(`globalJob.skills not castable to string[]: ${typeof first.globalJob.skills}`);
  }

  if (!VALID_STAGES.includes(first.stage as (typeof VALID_STAGES)[number])) {
    shapeIssues.push(`stage invalid: ${first.stage}`);
  }

  const createdAtVal = first.createdAt;
  if (createdAtVal !== null && createdAtVal !== undefined) {
    const isDate = createdAtVal instanceof Date;
    const isDateLike = typeof createdAtVal === "string" && !isNaN(Date.parse(createdAtVal));
    if (!isDate && !isDateLike) {
      shapeIssues.push(`createdAt not Date or date string: ${typeof createdAtVal}`);
    }
  }

  if (shapeIssues.length > 0) {
    for (const msg of shapeIssues) fail(msg);
  } else {
    pass("All expected fields present with correct types");
    pass(`matchScore in 0-100: ${first.matchScore}`);
    pass(`matchReasons castable to string[]`);
    pass(`globalJob.skills castable to string[]`);
    pass(`stage valid: ${first.stage}`);
    pass(`createdAt is Date or date string`);
  }

  // ─── 4. Duplicate check ──────────────────────────────────────────────────
  subheader("4. Duplicate globalJobIds");
  const gidCounts: Record<string, number> = {};
  for (const j of userJobs) {
    const gid = j.globalJobId;
    gidCounts[gid] = (gidCounts[gid] ?? 0) + 1;
  }
  const dupes = Object.entries(gidCounts).filter(([, c]) => c > 1);
  if (dupes.length > 0) {
    fail(`${dupes.length} duplicate globalJobId(s): ${dupes.map(([g]) => g).join(", ")}`);
  } else {
    pass("No duplicate globalJobIds");
  }

  // ─── 5. Sort order check ─────────────────────────────────────────────────
  subheader("5. Sort order (matchScore descending)");
  let prevScore: number | null = Infinity;
  let sortOk = true;
  for (const j of userJobs) {
    const s = j.matchScore ?? -1;
    if (s > (prevScore ?? -1)) {
      sortOk = false;
      break;
    }
    prevScore = s;
  }
  if (sortOk) {
    pass("matchScore is descending");
  } else {
    fail("matchScore is not in descending order");
  }

  // ─── 6. Performance analysis ──────────────────────────────────────────────
  subheader("6. Performance analysis");
  let totalBytes = 0;
  let withDescription = 0;
  for (const j of userJobs) {
    const desc = j.globalJob?.description;
    if (desc && typeof desc === "string") {
      totalBytes += desc.length * 2;
      withDescription++;
    }
    const app = j.application as { emailBody?: string } | null;
    if (app?.emailBody && typeof app.emailBody === "string") {
      totalBytes += app.emailBody.length * 2;
    }
  }
  const totalKB = Math.round(totalBytes / 1024);
  if (totalKB > PAYLOAD_WARN_KB) {
    warn(`Approx payload ~${totalKB}KB ( > ${PAYLOAD_WARN_KB}KB )`);
  } else {
    pass(`Approx payload ~${totalKB}KB`);
  }
  info(`Jobs with full description loaded: ${withDescription} / ${userJobs.length}`);

  // ─── 7. Verdict ──────────────────────────────────────────────────────────
  const hasShapeIssues = shapeIssues.length > 0;
  const hasDupes = dupes.length > 0;
  const sortFailed = !sortOk;
  const payloadWarn = totalKB > PAYLOAD_WARN_KB;

  verdict("Verdict");
  if (!hasShapeIssues) pass("Data shape OK");
  else fail("Data shape issues found");
  if (!hasDupes) pass("No duplicate globalJobIds");
  else fail("Duplicate globalJobIds found");
  if (sortOk) pass("Sort order correct");
  else fail("Sort order incorrect");
  if (!payloadWarn) pass("Payload size acceptable");
  else warn("Payload size may impact performance");

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
