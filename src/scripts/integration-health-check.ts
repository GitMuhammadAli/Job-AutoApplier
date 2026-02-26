/**
 * Integration health check — runs 6 checks: DB, all 8 scrapers, AI, SMTP, MX, scoring.
 * Run: npx tsx src/scripts/integration-health-check.ts
 *
 * Exit 0 = all pass, 1 = one or more failed.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { promises as dns } from "dns";

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
import { fetchRemotive } from "../lib/scrapers/remotive";
import { fetchArbeitnow } from "../lib/scrapers/arbeitnow";
import { fetchLinkedIn } from "../lib/scrapers/linkedin";
import { fetchJSearch } from "../lib/scrapers/jsearch";
import { fetchGoogleJobs } from "../lib/scrapers/google-jobs";
import { fetchAdzuna } from "../lib/scrapers/adzuna";
import { fetchIndeed } from "../lib/scrapers/indeed";
import { fetchRozee } from "../lib/scrapers/rozee";
import { generateWithGroq } from "../lib/groq";
import { getSystemTransporter } from "../lib/email";
import { computeMatchScore } from "../lib/matching/score-engine";

type CheckResult = { name: string; ok: boolean; detail: string; durationMs: number; error?: string };

async function runCheck(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, ok: false, detail: msg, durationMs: Date.now() - start, error: msg };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

const testQueries = [{ keyword: "software developer", cities: ["Lahore"], source: "test" as const }];

interface ScraperEntry {
  name: string;
  fn: () => Promise<unknown[]>;
  requiresKey?: string;
}

const scrapers: ScraperEntry[] = [
  { name: "LinkedIn", fn: () => withTimeout(fetchLinkedIn(testQueries), 15000, "LinkedIn") },
  { name: "JSearch", fn: () => withTimeout(fetchJSearch(testQueries, 3), 15000, "JSearch"), requiresKey: "RAPIDAPI_KEY" },
  { name: "Google", fn: () => withTimeout(fetchGoogleJobs(testQueries), 15000, "Google"), requiresKey: "SERPAPI_KEY" },
  { name: "Indeed", fn: () => withTimeout(fetchIndeed(testQueries), 15000, "Indeed"), requiresKey: "RAPIDAPI_KEY" },
  { name: "Remotive", fn: () => withTimeout(fetchRemotive(testQueries), 15000, "Remotive") },
  { name: "Arbeitnow", fn: () => withTimeout(fetchArbeitnow(), 15000, "Arbeitnow") },
  { name: "Adzuna", fn: () => withTimeout(fetchAdzuna(testQueries), 15000, "Adzuna"), requiresKey: "ADZUNA_APP_ID" },
  { name: "Rozee", fn: () => withTimeout(fetchRozee(testQueries), 15000, "Rozee") },
];

async function main() {
  const now = new Date();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`JOBPILOT HEALTH CHECK — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
  console.log(`${"=".repeat(50)}\n`);

  const results: CheckResult[] = [];

  // CHECK 1: Database
  results.push(
    await runCheck("Database", async () => {
      const count = await prisma.globalJob.count();
      const active = await prisma.globalJob.count({ where: { isActive: true } });
      return `Connected (${count.toLocaleString()} jobs, ${active.toLocaleString()} active)`;
    }),
  );

  // CHECK 2: Each scraper (with individual 15s timeout)
  const scraperResults: CheckResult[] = [];
  let working = 0;
  let total = 0;

  for (const scraper of scrapers) {
    if (scraper.requiresKey && !process.env[scraper.requiresKey]) {
      scraperResults.push({
        name: scraper.name,
        ok: false,
        detail: `Skipped (${scraper.requiresKey} not set)`,
        durationMs: 0,
        error: "API key not configured",
      });
      total++;
      continue;
    }
    total++;
    const result = await runCheck(scraper.name, async () => {
      const jobs = await scraper.fn();
      if (!Array.isArray(jobs) || jobs.length === 0) {
        throw new Error("0 jobs returned");
      }
      return `${jobs.length} jobs`;
    });
    scraperResults.push(result);
    if (result.ok) working++;
  }

  // CHECK 3: AI (Groq)
  results.push(
    await runCheck("AI (Groq)", async () => {
      const out = await generateWithGroq(
        "You are a test assistant. Reply with exactly: OK",
        "Reply with exactly: OK",
        { max_tokens: 10 },
      );
      if (!out?.includes("OK")) throw new Error("Unexpected AI response");
      return "Responding";
    }),
  );

  // CHECK 4: SMTP
  results.push(
    await runCheck("SMTP", async () => {
      if (!process.env.SMTP_USER) {
        throw new Error("Not configured (SMTP_USER missing)");
      }
      const transporter = getSystemTransporter();
      await transporter.verify();
      return `Connected to ${process.env.SMTP_HOST || "smtp-relay.brevo.com"}`;
    }),
  );

  // CHECK 5: MX Check
  results.push(
    await runCheck("MX Check", async () => {
      const mx = await dns.resolveMx("gmail.com");
      if (!mx?.length) throw new Error("No MX records for gmail.com");
      return "Working";
    }),
  );

  // CHECK 6: Scoring
  results.push(
    await runCheck("Scoring", async () => {
      const job = {
        title: "React Developer",
        company: "Acme",
        location: "Lahore, Pakistan",
        description: "React and TypeScript",
        salary: null,
        jobType: "full-time",
        experienceLevel: "mid",
        category: "Frontend Development",
        skills: ["react", "typescript"],
      };
      const settings = {
        keywords: ["react", "typescript"],
        city: "Lahore",
        country: "Pakistan",
        experienceLevel: "mid",
        workType: ["remote", "onsite"],
        jobType: ["full-time"],
        preferredCategories: ["Frontend Development"],
        preferredPlatforms: ["linkedin"],
        salaryMin: null,
        salaryMax: null,
      };
      const resumes = [{ id: "r1", name: "resume.pdf", content: "React, TypeScript", detectedSkills: ["react"] }];
      const result = computeMatchScore(job, settings, resumes);
      if (typeof result.score !== "number" || result.score < 0 || result.score > 100) {
        throw new Error(`Invalid score: ${result.score}`);
      }
      return `Sample score: ${result.score}`;
    }),
  );

  // Print core results
  for (const r of results) {
    const icon = r.ok ? "\u2705" : "\u274C";
    console.log(`${icon} ${r.name.padEnd(14)} ${r.detail}${r.durationMs > 0 ? ` (${r.durationMs}ms)` : ""}`);
  }

  // Print scraper results
  console.log(`\nScrapers:      ${working === total ? "\u2705" : "\u26A0\uFE0F"} ${working}/${total} working`);
  for (const r of scraperResults) {
    const icon = r.ok ? "\u2705" : "\u274C";
    console.log(`  ${icon} ${r.name.padEnd(12)} ${r.detail}${r.durationMs > 0 ? ` (${r.durationMs}ms)` : ""}`);
  }

  // Overall
  const criticalFailed = results.filter((r) => !r.ok);
  const failedScrapers = scraperResults.filter((r) => !r.ok);

  console.log(`\n${"=".repeat(50)}`);
  if (criticalFailed.length > 0) {
    console.log(`OVERALL: \u274C CRITICAL (${criticalFailed.length} core check(s) failed)`);
  } else if (failedScrapers.length > 0) {
    console.log(`OVERALL: \u26A0\uFE0F  DEGRADED (${failedScrapers.length} scraper(s) down)`);
  } else {
    console.log(`OVERALL: \u2705 HEALTHY`);
  }
  console.log(`${"=".repeat(50)}\n`);

  const allFailed = [...criticalFailed, ...failedScrapers];
  if (allFailed.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Health check crashed:", e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect().catch(() => {});
});
