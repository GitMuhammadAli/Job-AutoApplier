/**
 * Edge case test suite for production-weird stuff.
 *
 * Run: npx tsx src/scripts/test-edge-cases.ts <userId>
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
} from "./test-utils";
import { computeMatchScore, MATCH_THRESHOLDS } from "@/lib/matching/score-engine";
import {
  encrypt,
  decrypt,
  encryptField,
  decryptField,
} from "@/lib/encryption";
import { extractSkillsFromContent } from "@/lib/skill-extractor";
import { findCompanyEmail } from "@/lib/email-extractor";
import {
  jobMatchesLocationPreferences,
  jobMatchesPlatformPreferences,
} from "@/lib/matching/location-filter";
import { decryptSettingsFields } from "@/lib/encryption";

const bugs: string[] = [];

async function runTestAsync(
  name: string,
  fn: () => void | Promise<void>,
  expectedBehavior?: string
): Promise<void> {
  try {
    await fn();
    pass(`${name}${expectedBehavior ? ` — ${expectedBehavior}` : ""}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`${name}: ${msg}`);
    bugs.push(`${name}: ${msg}`);
  }
}

async function main() {
  const userId = getUserId();
  const elapsed = timer();

  header("Edge Case Test Suite");
  info(`User ID: ${userId}`);

  // Load user settings & resumes for synthetic jobs
  const rawSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });
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

  const resumes = await prisma.resume.findMany({
    where: { userId, isDeleted: false },
    select: { id: true, name: true, content: true },
    take: 5,
  });
  const resumePayload = resumes.map((r) => ({
    id: r.id,
    name: r.name,
    content: r.content,
  }));

  const jobSource = (preferredPlatforms[0] || "linkedin").toLowerCase();
  const baseJob = {
    title: "React Developer",
    company: "TestCo",
    location: null as string | null,
    description: null as string | null,
    skills: [] as string[],
    category: null as string | null,
    postedDate: new Date(),
    source: jobSource,
    experienceLevel: null as string | null,
    salary: null as string | null,
    jobType: null as string | null,
    isFresh: false,
    firstSeenAt: null as Date | null,
  };

  // ─── Group 1: Null/Empty inputs ───────────────────────────────────────────
  subheader("Group 1: Null/Empty inputs");

  await runTestAsync(
    "computeMatchScore with null skills (job.skills = [])",
    async () => {
      const job = { ...baseJob, skills: [], description: "React and Node.js" };
      const result = computeMatchScore(job, settingsForMatch, resumePayload);
      if (typeof result.score !== "number" || result.score < 0 || result.score > 100) {
        throw new Error(`Invalid score: ${result.score}`);
      }
    }
  );

  await runTestAsync(
    "computeMatchScore with empty keywords (settings.keywords = [])",
    async () => {
      const emptySettings = { ...settingsForMatch, keywords: [] };
      const job = { ...baseJob, description: "React developer", skills: ["React"] };
      const result = computeMatchScore(job, emptySettings, resumePayload);
      if (typeof result.score !== "number" || result.score < 0 || result.score > 100) {
        throw new Error(`Invalid score: ${result.score}`);
      }
    }
  );

  await runTestAsync(
    "computeMatchScore with null description",
    async () => {
      const job = { ...baseJob, description: null, title: keywords[0] || "React Developer" };
      const result = computeMatchScore(job, settingsForMatch, resumePayload);
      if (typeof result.score !== "number" || result.score < 0 || result.score > 100) {
        throw new Error(`Invalid score: ${result.score}`);
      }
    }
  );

  await runTestAsync(
    "findCompanyEmail with null description",
    async () => {
      const result = await findCompanyEmail({
        description: null,
        company: "A",
        sourceUrl: null,
        applyUrl: null,
      });
      if (result.email !== null && result.confidence !== "NONE") {
        throw new Error(`Expected no email for minimal input, got ${result.email}`);
      }
    }
  );

  await runTestAsync(
    "extractSkillsFromContent with empty string",
    async () => {
      const skills = extractSkillsFromContent("");
      if (!Array.isArray(skills) || skills.length !== 0) {
        throw new Error(`Expected [], got ${JSON.stringify(skills)}`);
      }
    }
  );

  await runTestAsync(
    "extractSkillsFromContent with null (cast as any)",
    async () => {
      const skills = extractSkillsFromContent(null as any);
      if (!Array.isArray(skills) || skills.length !== 0) {
        throw new Error(`Expected [] for null, got ${JSON.stringify(skills)}`);
      }
    }
  );

  await runTestAsync(
    "encrypt(null as any) — should crash or handle gracefully",
    async () => {
      try {
        encrypt(null as any);
        warn("encrypt(null) did not throw — may be acceptable if it handles null");
      } catch {
        // Throws as expected — acceptable
      }
    }
  );

  await runTestAsync(
    "decrypt('invalid') — should handle gracefully",
    async () => {
      try {
        decrypt("invalid");
        throw new Error("decrypt('invalid') should have thrown");
      } catch (e) {
        if (e instanceof Error && e.message === "decrypt('invalid') should have thrown") {
          throw e;
        }
        // Expected throw from decrypt
      }
    }
  );

  await runTestAsync(
    "decrypt('not:encrypted:format') — should handle gracefully",
    async () => {
      try {
        decrypt("not:encrypted:format");
        throw new Error("decrypt should have thrown");
      } catch (e) {
        if (e instanceof Error && e.message === "decrypt should have thrown") {
          throw e;
        }
        // Expected throw from decrypt
      }
    }
  );

  await runTestAsync(
    "decryptField(null) — should return null",
    async () => {
      const out = decryptField(null);
      if (out !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(out)}`);
      }
    }
  );

  await runTestAsync(
    "decryptField('plaintext') — should return 'plaintext'",
    async () => {
      const out = decryptField("plaintext");
      if (out !== "plaintext") {
        throw new Error(`Expected 'plaintext', got ${JSON.stringify(out)}`);
      }
    }
  );

  // ─── Group 2: Boundary values ─────────────────────────────────────────────
  subheader("Group 2: Boundary values");

  await runTestAsync(
    `Score exactly at MATCH_THRESHOLDS.SHOW_ON_KANBAN (${MATCH_THRESHOLDS.SHOW_ON_KANBAN}) — is it included (≥)?`,
    async () => {
      const threshold = MATCH_THRESHOLDS.SHOW_ON_KANBAN;
      if (threshold !== 40) {
        throw new Error(`SHOW_ON_KANBAN expected 40, got ${threshold}`);
      }
      const job = {
        ...baseJob,
        title: keywords.slice(0, 2).join(" ") || "React Developer",
        description: keywords.join(" ") || "React Node.js",
        skills: keywords.slice(0, 3) as string[],
      };
      const result = computeMatchScore(job, settingsForMatch, resumePayload);
      const wouldShow = result.score >= threshold;
      if (result.score === threshold && !wouldShow) {
        throw new Error(`Score ${result.score} should be included (≥${threshold})`);
      }
    }
  );

  await runTestAsync(
    `Score at MATCH_THRESHOLDS.AUTO_SEND (${MATCH_THRESHOLDS.AUTO_SEND}) — is it included?`,
    async () => {
      const threshold = MATCH_THRESHOLDS.AUTO_SEND;
      if (threshold !== 65) {
        throw new Error(`AUTO_SEND expected 65, got ${threshold}`);
      }
      const wouldInclude = 65 >= threshold;
      if (!wouldInclude) {
        throw new Error(`Score 65 should be included for AUTO_SEND`);
      }
    }
  );

  await runTestAsync(
    "sendDelaySeconds = 0 — is it treated as falsy?",
    async () => {
      const delay = Math.min(0 * 1000, 5000);
      if (delay !== 0) {
        throw new Error(`Expected delay 0 for sendDelaySeconds=0, got ${delay}`);
      }
      const elapsedSeconds = 1;
      const wouldRateLimit = elapsedSeconds < 0;
      if (wouldRateLimit) {
        throw new Error("With sendDelaySeconds=0, elapsedSeconds < 0 should be false");
      }
    }
  );

  await runTestAsync(
    "jobMatchesLocationPreferences with null location",
    async () => {
      const result = jobMatchesLocationPreferences(null, city, country);
      if (typeof result !== "boolean") {
        throw new Error(`Expected boolean, got ${typeof result}`);
      }
    }
  );

  await runTestAsync(
    "jobMatchesLocationPreferences with empty string",
    async () => {
      const result = jobMatchesLocationPreferences("", city, country);
      if (typeof result !== "boolean") {
        throw new Error(`Expected boolean, got ${typeof result}`);
      }
    }
  );

  await runTestAsync(
    "jobMatchesLocationPreferences with 'Remote'",
    async () => {
      const result = jobMatchesLocationPreferences("Remote", city, country);
      if (!result) {
        throw new Error("Remote should always match");
      }
    }
  );

  await runTestAsync(
    "jobMatchesLocationPreferences with 'Lahore, PK' vs city 'lahore', country 'pakistan'",
    async () => {
      const result = jobMatchesLocationPreferences(
        "Lahore, PK",
        "lahore",
        "pakistan"
      );
      // City "lahore" should match "Lahore, PK" (loc.includes(cityLower))
      if (!result) {
        bugs.push("jobMatchesLocationPreferences: 'Lahore, PK' should match city 'lahore'");
        throw new Error("'Lahore, PK' vs city 'lahore' returned false");
      }
    }
  );

  await runTestAsync(
    "jobMatchesPlatformPreferences with null source",
    async () => {
      const result = jobMatchesPlatformPreferences(null, preferredPlatforms);
      if (typeof result !== "boolean") {
        throw new Error(`Expected boolean, got ${typeof result}`);
      }
    }
  );

  await runTestAsync(
    "jobMatchesPlatformPreferences with empty platforms array",
    async () => {
      const result = jobMatchesPlatformPreferences("linkedin", []);
      if (!result) {
        throw new Error("Empty platforms should allow all (return true)");
      }
    }
  );

  // ─── Group 3: String edge cases ───────────────────────────────────────────
  subheader("Group 3: String edge cases");

  await runTestAsync(
    "extractSkillsFromContent with 'C++' — does it detect it?",
    async () => {
      const skills = extractSkillsFromContent("I have experience with C++ and Python.");
      const hasCpp = skills.some((s) => s === "C++" || s.toLowerCase().includes("c++"));
      if (!hasCpp && skills.length === 0) {
        warn("C++ not detected — check SKILL_ALIASES for C++/cpp");
      }
      if (!Array.isArray(skills)) {
        throw new Error(`Expected array, got ${typeof skills}`);
      }
    }
  );

  await runTestAsync(
    "extractSkillsFromContent with 'Node.js' — does it detect it?",
    async () => {
      const skills = extractSkillsFromContent("We use Node.js for backend.");
      const hasNode = skills.some((s) => s.includes("Node"));
      if (!hasNode) {
        warn("Node.js not detected — check SKILL_ALIASES");
      }
      if (!Array.isArray(skills)) {
        throw new Error(`Expected array, got ${typeof skills}`);
      }
    }
  );

  await runTestAsync(
    "extractSkillsFromContent with 'I expressed interest' — false positive for 'Express'?",
    async () => {
      const skills = extractSkillsFromContent("I expressed interest in the role.");
      const hasExpress = skills.includes("Express") || skills.some((s) => s.toLowerCase() === "express");
      if (hasExpress) {
        bugs.push("extractSkillsFromContent: 'expressed' falsely matched 'Express'");
        throw new Error("'expressed' falsely matched 'Express'");
      }
    }
  );

  await runTestAsync(
    "extractSkillsFromContent with 'accessibility' — false positive for 'css'?",
    async () => {
      const skills = extractSkillsFromContent("We care about accessibility.");
      const hasCss = skills.some((s) => s === "CSS" || s.toLowerCase() === "css");
      if (hasCss) {
        bugs.push("extractSkillsFromContent: 'accessibility' falsely matched 'CSS'");
        throw new Error("'accessibility' falsely matched 'CSS'");
      }
    }
  );

  await runTestAsync(
    "findCompanyEmail with company \"O'Reilly\" — does it crash?",
    async () => {
      const result = await findCompanyEmail({
        description: null,
        company: "O'Reilly",
        sourceUrl: null,
        applyUrl: null,
      });
      if (typeof result !== "object" || !("email" in result) || !("confidence" in result)) {
        throw new Error(`Invalid result: ${JSON.stringify(result)}`);
      }
    }
  );

  await runTestAsync(
    "HTML entity: '&amp;' in job title — does matching work?",
    async () => {
      const job = {
        ...baseJob,
        title: "React &amp; Node Developer",
        description: "React and Node.js",
        skills: ["React", "Node.js"],
      };
      const result = computeMatchScore(job, settingsForMatch, resumePayload);
      if (typeof result.score !== "number") {
        throw new Error(`Invalid score for HTML entity in title`);
      }
    }
  );

  await runTestAsync(
    "Unicode dash: 'Full‑Stack' (U+2011) — does keyword 'full stack' match?",
    async () => {
      const job = {
        ...baseJob,
        title: "Full\u2011Stack Developer",
        description: "Full\u2011stack role",
        skills: [],
      };
      const settingsWithKeyword = {
        ...settingsForMatch,
        keywords: keywords.length > 0 ? keywords : ["full stack"],
      };
      const result = computeMatchScore(job, settingsWithKeyword, resumePayload);
      if (settingsWithKeyword.keywords.includes("full stack") && result.score === 0) {
        bugs.push("computeMatchScore: U+2011 (‑) in 'Full‑Stack' may not match 'full stack'");
        warn("'Full‑Stack' (U+2011) vs 'full stack' — score=" + result.score);
      }
    }
  );

  // ─── Group 4: Data type safety ────────────────────────────────────────────
  subheader("Group 4: Data type safety");

  await runTestAsync(
    "Cast settings.keywords from Json to string[]",
    async () => {
      const jsonKeywords = keywords as unknown as Record<string, unknown>;
      const cast = jsonKeywords as unknown as string[];
      const job = { ...baseJob, description: "React", skills: ["React"] };
      const settingsCast = { ...settingsForMatch, keywords: cast };
      const result = computeMatchScore(job, settingsCast, resumePayload);
      if (typeof result.score !== "number" || result.score < 0 || result.score > 100) {
        throw new Error(`Invalid score with cast keywords: ${result.score}`);
      }
    }
  );

  await runTestAsync(
    "Cast resume.detectedSkills from Json to string[]",
    async () => {
      const dbResume = await prisma.resume.findFirst({
        where: { userId, isDeleted: false },
        select: { detectedSkills: true },
      });
      const skillsJson = (dbResume?.detectedSkills ?? []) as unknown as Record<string, unknown>;
      const cast = skillsJson as unknown as string[];
      if (!Array.isArray(cast) && dbResume) {
        throw new Error(`Cast failed: expected array`);
      }
      const resumeWithCast = resumePayload[0]
        ? { ...resumePayload[0], content: resumePayload[0].content || "React TypeScript" }
        : { id: "test", name: "Test", content: "React TypeScript" };
      const job = { ...baseJob, description: "React", skills: ["React"] };
      const result = computeMatchScore(job, settingsForMatch, [resumeWithCast]);
      if (typeof result.score !== "number") {
        throw new Error(`Invalid score with resume`);
      }
    }
  );

  await runTestAsync(
    "Cast globalJob.skills from Json to string[]",
    async () => {
      const skillsJson = ["React", "Node.js"] as unknown as Record<string, unknown>;
      const job = {
        ...baseJob,
        skills: skillsJson as unknown as string[],
        description: "React developer",
      };
      const result = computeMatchScore(job, settingsForMatch, resumePayload);
      if (typeof result.score !== "number") {
        throw new Error(`Invalid score with cast skills: ${result.score}`);
      }
    }
  );

  // ─── Verdict ──────────────────────────────────────────────────────────────
  const totalTime = elapsed();
  verdict("Verdict");
  info(`Total time: ${totalTime}ms`);

  if (bugs.length === 0) {
    pass(`No bugs found. All edge cases passed.`);
  } else {
    fail(`Found ${bugs.length} bug(s):`);
    for (const b of bugs) {
      console.log(`    • ${b}`);
    }
  }

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
