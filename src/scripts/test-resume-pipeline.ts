/**
 * Resume Pipeline Test — JobPilot
 *
 * Standalone test for resume text extraction and skill detection.
 * Tests: skill extractor, DB comparison, keyword overlap, URL accessibility.
 *
 * Run:  npx tsx src/scripts/test-resume-pipeline.ts <userId>
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
  TestResult,
  summarize,
} from "./test-utils";
import { extractSkillsFromContent } from "@/lib/skill-extractor";

async function main() {
  const userId = getUserId();
  const results: TestResult[] = [];

  try {
    header("RESUME PIPELINE TEST — JobPilot");
    info(`User ID: ${userId}`);
    console.log("");

    // ── 1. Fetch resumes ──
    subheader("1. Resumes");
    const fetchTimer = timer();
    const resumes = await prisma.resume.findMany({
      where: { userId, deletedAt: null, isDeleted: false },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (resumes.length === 0) {
      fail("No resumes found (deletedAt is null)");
      results.push({ name: "Resumes", status: "fail", issues: ["No resumes"], duration: fetchTimer() });
    } else {
      pass(`Found ${resumes.length} resume(s)`);
      for (const r of resumes) {
        const skillCount = r.detectedSkills?.length ?? 0;
        const quality = r.textQuality ?? "unknown";
        const defaultTag = r.isDefault ? " [DEFAULT]" : "";
        info(`  • "${r.name}" — quality: ${quality}, skills: ${skillCount}${defaultTag}`);
      }
      results.push({ name: "Resumes", status: "pass", issues: [], duration: fetchTimer() });
    }

    const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0];
    if (!defaultResume) {
      verdict("VERDICT: No resume to test — cannot proceed");
      summarize(results);
      return;
    }

    // ── 2. Content preview & skill extraction ──
    subheader("2. Default Resume — Content & Skill Extraction");
    const extractTimer = timer();

    if (!defaultResume.content) {
      warn("Default resume has no content");
      results.push({ name: "Content", status: "warn", issues: ["No content to extract skills from"], duration: extractTimer() });
    } else {
      const preview = defaultResume.content.slice(0, 200);
      info(`Content preview: "${preview}${defaultResume.content.length > 200 ? "..." : ""}"`);
      info(`Content length: ${defaultResume.content.length} chars`);

      const extracted = extractSkillsFromContent(defaultResume.content);
      const dbSkills = (defaultResume.detectedSkills ?? []) as string[];

      pass(`Extracted ${extracted.length} skills from content`);
      info(`DB stored: ${dbSkills.length} skills`);

      // Compare extracted vs DB
      const extractedSet = new Set(extracted.map((s) => s.toLowerCase()));
      const dbSet = new Set(dbSkills.map((s) => s.toLowerCase()));
      const inBoth = extracted.filter((s) => dbSet.has(s.toLowerCase()));
      const onlyExtracted = extracted.filter((s) => !dbSet.has(s.toLowerCase()));
      const onlyDb = dbSkills.filter((s) => !extractedSet.has(s.toLowerCase()));

      if (onlyExtracted.length > 0) info(`  New (extractor only): ${onlyExtracted.join(", ")}`);
      if (onlyDb.length > 0) warn(`  In DB but not re-extracted: ${onlyDb.join(", ")}`);
      pass(`Overlap: ${inBoth.length} skills match`);

      const contentIssues: string[] = [];
      if (extracted.length === 0 && defaultResume.content.length > 50) contentIssues.push("Extractor returned 0 skills for non-trivial content");
      if (onlyDb.length > 5) contentIssues.push("Significant drift between DB and extractor");

      results.push({
        name: "Content",
        status: contentIssues.length > 0 ? "warn" : "pass",
        issues: contentIssues,
        duration: extractTimer(),
      });
    }

    // ── 3. False positive check ──
    subheader("3. False Positive Check");
    const fpTimer = timer();
    const fpText = "I expressed interest in the role and communicated effectively.";
    const fpSkills = extractSkillsFromContent(fpText);
    const hasExpress = fpSkills.some((s) => s.toLowerCase() === "express");

    if (hasExpress) {
      fail(`False positive: "Express" detected in "${fpText}"`);
      results.push({ name: "FalsePositives", status: "fail", issues: ["Express matched in 'expressed'"], duration: fpTimer() });
    } else {
      pass(`No false positive for "expressed" → Express`);
      results.push({ name: "FalsePositives", status: "pass", issues: [], duration: fpTimer() });
    }

    // ── 4. Skill matching overlap with user keywords ──
    subheader("4. Skill vs Keyword Overlap");
    const overlapTimer = timer();
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { keywords: true },
    });

    const userKeywords = (settings?.keywords ?? []) as string[];
    const resumeSkills = (defaultResume.detectedSkills ?? []) as string[];

    if (userKeywords.length === 0) {
      warn("No user keywords configured — cannot compute overlap");
      results.push({ name: "KeywordOverlap", status: "warn", issues: ["No keywords in settings"], duration: overlapTimer() });
    } else {
      const kwLower = new Set(userKeywords.map((k) => k.toLowerCase().trim()));
      const skillLower = new Set(resumeSkills.map((s) => s.toLowerCase().trim()));
      const overlap = userKeywords.filter((k) => skillLower.has(k.toLowerCase().trim()));
      const overlapCount = overlap.length;

      pass(`Keywords: ${userKeywords.length} | Resume skills: ${resumeSkills.length}`);
      pass(`Overlap: ${overlapCount}/${userKeywords.length} — ${overlap.join(", ") || "(none)"}`);

      const overlapIssues: string[] = [];
      if (overlapCount === 0) overlapIssues.push("No keyword overlap with resume skills");
      else if (overlapCount < userKeywords.length * 0.3) overlapIssues.push("Low overlap — resume may not reflect job preferences");

      results.push({
        name: "KeywordOverlap",
        status: overlapIssues.length > 0 ? "warn" : "pass",
        issues: overlapIssues,
        duration: overlapTimer(),
      });
    }

    // ── 5. Resume URL accessibility ──
    subheader("5. Resume URL Accessibility");
    const urlTimer = timer();
    const fileUrl = defaultResume.fileUrl;

    if (!fileUrl) {
      warn("No fileUrl on default resume — skipping HEAD check");
      results.push({ name: "UrlAccess", status: "warn", issues: ["No fileUrl"], duration: urlTimer() });
    } else {
      try {
        const res = await fetch(fileUrl, { method: "HEAD", redirect: "follow" });
        if (res.ok) {
          pass(`URL accessible: ${res.status}`);
          results.push({ name: "UrlAccess", status: "pass", issues: [], duration: urlTimer() });
        } else {
          warn(`URL returned ${res.status}`);
          results.push({ name: "UrlAccess", status: "warn", issues: [`HTTP ${res.status}`], duration: urlTimer() });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(`URL fetch failed: ${msg}`);
        results.push({ name: "UrlAccess", status: "fail", issues: [msg], duration: urlTimer() });
      }
    }

    // ── 6. Verdict ──
    const fails = results.filter((r) => r.status === "fail").length;
    const warns = results.filter((r) => r.status === "warn").length;
    verdict(fails > 0 ? "VERDICT: Failures detected" : warns > 0 ? "VERDICT: Passed with warnings" : "VERDICT: All tests passed");
    summarize(results);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  \x1b[31m❌ Fatal error: ${msg}\x1b[0m`);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => process.exit(1));
