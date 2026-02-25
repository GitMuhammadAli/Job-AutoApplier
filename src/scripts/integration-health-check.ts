/**
 * Integration health check — runs 6 checks: DB, scrapers, AI, SMTP, MX, scoring.
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
import { generateWithGroq } from "../lib/groq";
import { getSystemTransporter } from "../lib/email";
import { computeMatchScore } from "../lib/matching/score-engine";

type CheckResult = { name: string; ok: boolean; durationMs: number; error?: string };

async function runCheck(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, ok: true, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, ok: false, durationMs: Date.now() - start, error: msg };
  }
}

async function main() {
  const results: CheckResult[] = [];

  results.push(
    await runCheck("DB", async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
  );

  results.push(
    await runCheck("Scrapers (Remotive)", async () => {
      const jobs = await fetchRemotive();
      if (!Array.isArray(jobs) || jobs.length === 0) {
        throw new Error("Remotive returned no jobs");
      }
    }),
  );

  results.push(
    await runCheck("AI (Groq)", async () => {
      const out = await generateWithGroq(
        "You are a test assistant. Reply with exactly: OK",
        "Reply with exactly: OK",
        { max_tokens: 10 },
      );
      if (!out?.includes("OK")) throw new Error("Unexpected AI response");
    }),
  );

  results.push(
    await runCheck("SMTP", async () => {
      const transporter = getSystemTransporter();
      await transporter.verify();
    }),
  );

  results.push(
    await runCheck("MX (gmail.com)", async () => {
      const mx = await dns.resolveMx("gmail.com");
      if (!mx?.length) throw new Error("No MX records");
    }),
  );

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
    }),
  );

  for (const r of results) {
    const status = r.ok ? "✓" : "✗";
    const detail = r.ok ? `${r.durationMs}ms` : r.error;
    console.log(`${status} ${r.name}: ${detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("Health check crashed:", e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect().catch(() => {});
});
