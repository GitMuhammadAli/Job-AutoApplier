/**
 * End-to-end test: calls every scraper with real keywords/cities,
 * then runs the matching engine on the results with a fake user profile.
 *
 * Run:  npx tsx src/scripts/test-scrapers.ts
 *
 * Requires env vars: DATABASE_URL, RAPIDAPI_KEY, ADZUNA_APP_ID/KEY, SERPAPI_KEY
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency)
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
import { fetchLinkedIn } from "../lib/scrapers/linkedin";
import { fetchIndeed } from "../lib/scrapers/indeed";
import { fetchRemotive } from "../lib/scrapers/remotive";
import { fetchArbeitnow } from "../lib/scrapers/arbeitnow";
import { fetchAdzuna } from "../lib/scrapers/adzuna";
import { fetchRozee } from "../lib/scrapers/rozee";
import { fetchJSearch } from "../lib/scrapers/jsearch";
import { fetchGoogleJobs } from "../lib/scrapers/google-jobs";
import { computeMatchScore, MATCH_THRESHOLDS } from "../lib/matching/score-engine";
import { generateApplicationEmail, type GenerateEmailInput } from "../lib/ai-email-generator";
import { generateCoverLetterFromInput } from "../lib/ai-cover-letter-generator";
import type { SearchQuery } from "../types";

const QUERIES: SearchQuery[] = [
  { keyword: "react", cities: ["Lahore", "Pakistan", "Remote"] },
  { keyword: "node.js", cities: ["Lahore", "Pakistan", "Remote"] },
  { keyword: "next.js", cities: ["Lahore", "Remote"] },
  { keyword: "javascript", cities: ["Lahore", "Pakistan", "Remote"] },
  { keyword: "full stack developer", cities: ["Lahore", "Pakistan"] },
];

const FAKE_USER_SETTINGS = {
  keywords: [
    "react", "next.js", "node.js", "javascript", "typescript",
    "nestjs", "express", "mongodb", "postgresql", "docker",
    "tailwind", "html", "css", "full stack",
  ],
  city: "Lahore",
  country: "Pakistan",
  experienceLevel: "entry",
  workType: ["onsite", "remote", "hybrid"],
  jobType: ["full-time", "contract"],
  preferredCategories: ["Frontend Development", "Backend Development", "Full Stack Development"],
  preferredPlatforms: ["linkedin", "indeed", "remotive", "arbeitnow", "adzuna", "rozee", "jsearch", "google"],
  salaryMin: null,
  salaryMax: null,
};

const FAKE_RESUMES = [
  {
    id: "test-resume-1",
    name: "Ali_Shahid_Resume.pdf",
    content: `Ali Shahid — Full Stack Developer
    Skills: React, Next.js, Node.js, NestJS, TypeScript, JavaScript, Express, MongoDB, PostgreSQL, Docker, Tailwind CSS, Git, REST APIs
    Experience: Full-Stack Developer at NgXoft Solutions. Built 10+ responsive UI modules using React, Next.js, and Tailwind CSS.
    Architected NestJS backend services with modular controllers. Containerized application workflows using Docker.
    Projects: CareCircle, JobPilot, RentWise, Stock-Pilot, AuthKit Pro
    Education: BS Computer Science, Bahria University`,
  },
];

interface ScraperEntry {
  name: string;
  fn: (q: SearchQuery[]) => Promise<any[]>;
  needsKey?: string;
}

const SCRAPERS: ScraperEntry[] = [
  { name: "linkedin", fn: (q) => fetchLinkedIn(q) },
  { name: "indeed", fn: (q) => fetchIndeed(q), needsKey: "RAPIDAPI_KEY" },
  { name: "remotive", fn: (q) => fetchRemotive(q) },
  { name: "arbeitnow", fn: () => fetchArbeitnow() },
  { name: "adzuna", fn: (q) => fetchAdzuna(q), needsKey: "ADZUNA_APP_ID" },
  { name: "rozee", fn: (q) => fetchRozee(q), needsKey: "SERPAPI_KEY" },
  { name: "jsearch", fn: (q) => fetchJSearch(q, 3), needsKey: "RAPIDAPI_KEY" },
  { name: "google", fn: (q) => fetchGoogleJobs(q), needsKey: "SERPAPI_KEY" },
];

function separator(title: string) {
  console.log("");
  console.log("═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

async function main() {
  // Override Date.getDate so both Rozee (odd days) and Google Jobs (even days) run
  const origGetDate = Date.prototype.getDate;
  let forcedDay: number | null = null;
  Date.prototype.getDate = function () {
    return forcedDay ?? origGetDate.call(this);
  };

  separator("SCRAPER TEST — Testing all 8 platforms");
  console.log(`Keywords: ${QUERIES.map((q) => q.keyword).join(", ")}`);
  console.log(`Cities: ${QUERIES[0].cities.join(", ")}`);
  console.log("");

  const allJobs: Array<any & { _source: string }> = [];
  const results: { name: string; count: number; status: string; error?: string; sample?: string }[] = [];

  for (const scraper of SCRAPERS) {
    const label = scraper.name.toUpperCase().padEnd(10);
    process.stdout.write(`  [${label}] Fetching...`);

    if (scraper.needsKey && !process.env[scraper.needsKey]) {
      console.log(` SKIPPED (no ${scraper.needsKey})`);
      results.push({ name: scraper.name, count: 0, status: "skipped", error: `Missing ${scraper.needsKey}` });
      continue;
    }

    try {
      // Force correct day-of-month for date-gated scrapers
      if (scraper.name === "google") forcedDay = 2;    // even day
      else if (scraper.name === "rozee") forcedDay = 1; // odd day
      else forcedDay = null;

      const startMs = Date.now();
      const jobs = await scraper.fn(QUERIES);
      const elapsed = Date.now() - startMs;
      forcedDay = null;

      if (jobs.length === 0) {
        console.log(` 0 jobs (${elapsed}ms) — EMPTY`);
        results.push({ name: scraper.name, count: 0, status: "empty" });
      } else {
        console.log(` ${jobs.length} jobs (${elapsed}ms) — OK`);
        const sample = jobs[0];
        results.push({
          name: scraper.name,
          count: jobs.length,
          status: "ok",
          sample: `"${sample.title}" at ${sample.company} (${sample.location ?? "n/a"})`,
        });
        for (const j of jobs) {
          allJobs.push({ ...j, _source: scraper.name });
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log(` ERROR: ${msg.slice(0, 80)}`);
      results.push({ name: scraper.name, count: 0, status: "error", error: msg.slice(0, 120) });
    }
  }

  separator("SCRAPER RESULTS SUMMARY");
  console.log("");
  console.log("  Source       Count   Status");
  console.log("  " + "─".repeat(40));
  for (const r of results) {
    const name = r.name.padEnd(12);
    const count = String(r.count).padStart(5);
    const status = r.status === "ok" ? "OK" : r.status === "empty" ? "EMPTY (0 jobs)" : r.status === "skipped" ? `SKIPPED (${r.error})` : `ERROR: ${r.error?.slice(0, 50)}`;
    console.log(`  ${name} ${count}   ${status}`);
  }
  const totalScraped = allJobs.length;
  console.log("  " + "─".repeat(40));
  console.log(`  ${"TOTAL".padEnd(12)} ${String(totalScraped).padStart(5)}`);
  console.log("");

  for (const r of results) {
    if (r.sample) console.log(`  [${r.name}] Sample: ${r.sample}`);
  }

  if (totalScraped === 0) {
    console.log("\n  No jobs scraped from any source. Cannot test matching engine.\n");
    process.exit(1);
  }

  separator("MATCHING ENGINE TEST");
  console.log(`  Testing ${totalScraped} scraped jobs against fake user profile...`);
  console.log(`  User keywords: ${FAKE_USER_SETTINGS.keywords.join(", ")}`);
  console.log(`  City: ${FAKE_USER_SETTINGS.city} | Country: ${FAKE_USER_SETTINGS.country}`);
  console.log("");

  let matched = 0;
  let rejected = 0;
  const rejectReasons = new Map<string, number>();
  const rejectBySource = new Map<string, Map<string, number>>();
  const matchedJobs: Array<{ title: string; company: string; location: string; source: string; score: number; reasons: string[] }> = [];
  const rejectedSamples: Array<{ title: string; source: string; reason: string; score: number }> = [];

  for (const job of allJobs) {
    const result = computeMatchScore(
      {
        title: job.title || "",
        company: job.company || "",
        location: job.location || null,
        description: job.description || null,
        salary: job.salary || null,
        jobType: job.jobType || null,
        experienceLevel: job.experienceLevel || null,
        category: job.category || null,
        skills: job.skills || [],
        source: job._source,
        isFresh: true,
        firstSeenAt: new Date(),
      },
      FAKE_USER_SETTINGS,
      FAKE_RESUMES,
    );

    if (result.score >= MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
      matched++;
      matchedJobs.push({
        title: job.title,
        company: job.company,
        location: job.location ?? "n/a",
        source: job._source,
        score: result.score,
        reasons: result.reasons,
      });
    } else {
      rejected++;
      const reason = result.reasons[0] || "Low score";
      rejectReasons.set(reason, (rejectReasons.get(reason) || 0) + 1);

      if (!rejectBySource.has(job._source)) rejectBySource.set(job._source, new Map());
      const srcMap = rejectBySource.get(job._source)!;
      srcMap.set(reason, (srcMap.get(reason) || 0) + 1);

      if (rejectedSamples.length < 10 && job._source === "linkedin") {
        rejectedSamples.push({ title: job.title, source: job._source, reason, score: result.score });
      }
    }
  }

  matchedJobs.sort((a, b) => b.score - a.score);

  const matchedBySource = new Map<string, number>();
  for (const j of matchedJobs) {
    matchedBySource.set(j.source, (matchedBySource.get(j.source) || 0) + 1);
  }

  console.log("  MATCH RESULTS:");
  console.log(`    Total scraped:  ${totalScraped}`);
  console.log(`    Matched (≥${MATCH_THRESHOLDS.SHOW_ON_KANBAN}):  ${matched}`);
  console.log(`    Rejected:       ${rejected}`);
  console.log("");

  console.log("  Matched by source:");
  for (const [src, count] of Array.from(matchedBySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(12)} ${count}`);
  }
  console.log("");

  console.log("  Rejection reasons:");
  for (const [reason, count] of Array.from(rejectReasons.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason.padEnd(30)} ${count}`);
  }
  console.log("");

  console.log("  Rejection breakdown by source:");
  for (const [src, reasons] of Array.from(rejectBySource.entries())) {
    console.log(`    [${src}]`);
    for (const [reason, count] of Array.from(reasons.entries()).sort((a: [string, number], b: [string, number]) => b[1] - a[1])) {
      console.log(`      ${reason.padEnd(30)} ${count}`);
    }
  }
  console.log("");

  if (rejectedSamples.length > 0) {
    console.log("  Sample REJECTED LinkedIn jobs (why?):");
    for (const s of rejectedSamples) {
      console.log(`    "${s.title}" → ${s.reason} (score: ${s.score})`);
    }
    console.log("");
  }

  console.log("  Top 10 matched jobs:");
  for (const j of matchedJobs.slice(0, 10)) {
    console.log(`    [${j.score}%] [${j.source}] ${j.title} — ${j.company} (${j.location})`);
    console.log(`           ${j.reasons.join(" · ")}`);
  }

  separator("DIAGNOSIS");
  const workingSources = results.filter((r) => r.status === "ok").map((r) => r.name);
  const brokenSources = results.filter((r) => r.status === "error" || r.status === "empty").map((r) => r.name);
  const skippedSources = results.filter((r) => r.status === "skipped").map((r) => r.name);

  console.log(`  Working scrapers:  ${workingSources.length > 0 ? workingSources.join(", ") : "NONE"}`);
  console.log(`  Broken/empty:      ${brokenSources.length > 0 ? brokenSources.join(", ") : "none"}`);
  console.log(`  Skipped (no key):  ${skippedSources.length > 0 ? skippedSources.join(", ") : "none"}`);
  console.log("");

  if (brokenSources.length > 0) {
    console.log("  ISSUES FOUND:");
    for (const r of results.filter((r) => r.status === "error" || r.status === "empty")) {
      console.log(`    - ${r.name}: ${r.status === "empty" ? "returned 0 jobs" : r.error}`);
    }
    console.log("");
  }

  if (matchedBySource.size <= 1) {
    console.log("  WARNING: Only 1 source produced matched jobs. Other scrapers may be broken or blocked.");
  }

  if (matched === 0) {
    console.log("  CRITICAL: No jobs matched. The matching engine may be too strict or all scrapers are failing.");
  }

  console.log("");

  // ═══════════════════════════════════════════
  // PHASE 3: AI EMAIL + COVER LETTER TEST
  // ═══════════════════════════════════════════
  await testAIEmailGeneration(matchedJobs, allJobs);
}

const APPLICATION_MODES = [
  { key: "MANUAL", label: "Manual", tone: "professional", language: "English", customClosing: null, customPrompt: null, signature: null },
  { key: "SEMI_AUTO", label: "Semi-Auto", tone: "confident", language: "English", customClosing: "Looking forward to hearing from you!", customPrompt: null, signature: "Ali Shahid\nFull Stack Developer\nhttps://alishahid-dev.vercel.app" },
  { key: "FULL_AUTO", label: "Full Auto", tone: "friendly", language: "English", customClosing: "Best regards,", customPrompt: "Keep it under 150 words. Focus on React and Next.js experience.", signature: "Ali Shahid — Full Stack Dev" },
  { key: "INSTANT", label: "Instant", tone: "casual", language: "English", customClosing: "Cheers,", customPrompt: "Be very concise (100 words max). Mention Docker and PostgreSQL experience. Sound natural, like a human.", signature: "Ali Shahid\nhttps://alishahid-dev.vercel.app" },
] as const;

async function testAIEmailGeneration(
  matchedJobs: Array<{ title: string; company: string; location: string; source: string; score: number; reasons: string[] }>,
  allJobs: any[],
) {
  separator("AI EMAIL & COVER LETTER TEST — All 4 Modes");

  if (!process.env.GROQ_API_KEY) {
    console.log("  SKIPPED: GROQ_API_KEY not set in .env");
    return;
  }

  // Pick the best matched job to test against
  const testJob = matchedJobs[0];
  if (!testJob) {
    console.log("  SKIPPED: No matched jobs to generate emails for.");
    return;
  }

  // Find the full scraped job data for description/skills
  const fullJob = allJobs.find(
    (j) => j.title === testJob.title && j.company === testJob.company && j._source === testJob.source
  );

  console.log(`  Test job: "${testJob.title}" at ${testJob.company} (${testJob.location})`);
  console.log(`  Source: ${testJob.source} | Score: ${testJob.score}%`);
  console.log(`  Description length: ${fullJob?.description?.length ?? 0} chars`);
  console.log("");

  const baseInput: Omit<GenerateEmailInput, "settings"> = {
    job: {
      title: testJob.title,
      company: testJob.company,
      location: testJob.location,
      salary: fullJob?.salary || null,
      skills: fullJob?.skills || [],
      description: fullJob?.description || null,
      source: testJob.source,
    },
    profile: {
      fullName: "Ali Shahid",
      phone: null,
      experienceLevel: "entry",
      linkedinUrl: "https://linkedin.com/in/alishahid-fswebdev",
      githubUrl: "https://github.com/GitMuhammadAli",
      portfolioUrl: "https://alishahid-dev.vercel.app",
      includeLinkedin: true,
      includeGithub: true,
      includePortfolio: true,
    },
    resume: {
      name: "Ali_Shahid_Resume.pdf",
      content: `Ali Shahid — Full Stack Developer
Skills: React, Next.js, Node.js, NestJS, TypeScript, JavaScript, Express, MongoDB, PostgreSQL, Docker, Tailwind CSS, Git, REST APIs
Experience: Full-Stack Developer at NgXoft Solutions (Jan 2025 - Present).
- Developed and shipped 10+ responsive UI modules using React, Next.js, and Tailwind CSS
- Architected NestJS backend services with modular controllers across 15+ API endpoints
- Containerized application workflows using Docker, cutting setup time from 2 hours to 10 minutes
- Designed and integrated REST APIs for authentication, role-based dashboards serving 500+ daily requests
Projects: CareCircle (RAG-based Q&A, AI care summaries), JobPilot (AI job automation), RentWise (decentralized rental platform)
Education: BS Computer Science, Bahria University (2021-2025)`,
      detectedSkills: ["React", "Next.js", "Node.js", "NestJS", "TypeScript", "JavaScript", "Express", "MongoDB", "PostgreSQL", "Docker", "Tailwind CSS", "Git", "REST APIs"],
    },
    template: null,
  };

  const emailResults: Array<{
    mode: string;
    tone: string;
    emailOk: boolean;
    coverLetterOk: boolean;
    subject?: string;
    bodyPreview?: string;
    coverLetterPreview?: string;
    emailError?: string;
    coverLetterError?: string;
    emailMs?: number;
    coverLetterMs?: number;
  }> = [];

  for (const mode of APPLICATION_MODES) {
    const modeLabel = `${mode.label} (${mode.key})`.padEnd(25);
    process.stdout.write(`  [${modeLabel}] `);

    const input: GenerateEmailInput = {
      ...baseInput,
      settings: {
        preferredTone: mode.tone,
        emailLanguage: mode.language,
        customClosing: mode.customClosing,
        customSystemPrompt: mode.customPrompt,
        defaultSignature: mode.signature,
      },
    };

    const result: (typeof emailResults)[number] = {
      mode: mode.key,
      tone: mode.tone,
      emailOk: false,
      coverLetterOk: false,
    };

    // Test email generation
    try {
      const emailStart = Date.now();
      const email = await generateApplicationEmail(input);
      result.emailMs = Date.now() - emailStart;
      result.emailOk = true;
      result.subject = email.subject;
      result.bodyPreview = email.body.slice(0, 200).replace(/\n/g, " ") + "...";
      process.stdout.write(`Email OK (${result.emailMs}ms) `);
    } catch (err: any) {
      result.emailError = err?.message || String(err);
      process.stdout.write(`Email FAIL `);
    }

    // Test cover letter generation
    try {
      const clStart = Date.now();
      const coverLetter = await generateCoverLetterFromInput(input);
      result.coverLetterMs = Date.now() - clStart;
      result.coverLetterOk = true;
      result.coverLetterPreview = coverLetter.slice(0, 200).replace(/\n/g, " ") + "...";
      process.stdout.write(`| CL OK (${result.coverLetterMs}ms)`);
    } catch (err: any) {
      result.coverLetterError = err?.message || String(err);
      process.stdout.write(`| CL FAIL`);
    }

    console.log("");
    emailResults.push(result);

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1500));
  }

  separator("AI GENERATION RESULTS");
  console.log("");
  console.log("  Mode                  Tone          Email    Cover Letter");
  console.log("  " + "─".repeat(65));
  for (const r of emailResults) {
    const mode = r.mode.padEnd(20);
    const tone = r.tone.padEnd(14);
    const email = r.emailOk ? `OK (${r.emailMs}ms)`.padEnd(15) : "FAIL".padEnd(15);
    const cl = r.coverLetterOk ? `OK (${r.coverLetterMs}ms)` : "FAIL";
    console.log(`  ${mode} ${tone} ${email} ${cl}`);
  }
  console.log("");

  for (const r of emailResults) {
    console.log(`  ── ${r.mode} (tone: ${r.tone}) ──`);
    if (r.emailOk) {
      console.log(`  Subject: ${r.subject}`);
      console.log(`  Body:    ${r.bodyPreview}`);
    } else {
      console.log(`  Email Error: ${r.emailError}`);
    }
    if (r.coverLetterOk) {
      console.log(`  Cover L: ${r.coverLetterPreview}`);
    } else {
      console.log(`  CL Error: ${r.coverLetterError}`);
    }
    console.log("");
  }

  const allEmailsOk = emailResults.every((r) => r.emailOk);
  const allCLsOk = emailResults.every((r) => r.coverLetterOk);
  const anyFail = emailResults.some((r) => !r.emailOk || !r.coverLetterOk);

  separator("AI TEST VERDICT");
  console.log(`  Email generation:        ${allEmailsOk ? "ALL 4 MODES PASSED" : "SOME FAILED"}`);
  console.log(`  Cover letter generation:  ${allCLsOk ? "ALL 4 MODES PASSED" : "SOME FAILED"}`);
  console.log(`  Groq API:                ${anyFail ? "ISSUES DETECTED" : "WORKING"}`);
  console.log("");

  if (anyFail) {
    console.log("  FAILURES:");
    for (const r of emailResults) {
      if (!r.emailOk) console.log(`    - ${r.mode} email: ${r.emailError}`);
      if (!r.coverLetterOk) console.log(`    - ${r.mode} cover letter: ${r.coverLetterError}`);
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
