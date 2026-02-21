/**
 * DATA vs CODE bug diagnostic script.
 * Loads real GlobalJobs from the DB and traces them through the matching engine,
 * reporting every case where data quirks cause silent failures.
 *
 * Run:  npx tsx src/scripts/test-data-vs-code.ts
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

import { PrismaClient } from "@prisma/client";
import { computeMatchScore, MATCH_THRESHOLDS } from "../lib/matching/score-engine";
import { decryptSettingsFields } from "../lib/encryption";

const prisma = new PrismaClient();

const UNICODE_DASH_RE = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/;
const NBSP_RE = /[\u00A0\u2000-\u200B\u202F\u205F\u3000]/;
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|nbsp|ndash|mdash|#\d+|#x[0-9a-f]+);/i;
const SMART_QUOTE_RE = /[\u2018\u2019\u201C\u201D]/;

interface AnalysisResult {
  unicodeDashJobs: Array<{ title: string; source: string; chars: string }>;
  nbspJobs: Array<{ title: string; source: string; field: string }>;
  htmlEntityJobs: Array<{ title: string; source: string; field: string; sample: string }>;
  smartQuoteJobs: Array<{ title: string; source: string }>;
  nullDescJobs: Array<{ source: string; title: string }>;
  nullCategoryJobs: Array<{ source: string; title: string }>;
  categoryMismatchJobs: Array<{ source: string; title: string; dbCategory: string }>;
  locationMisses: Array<{ title: string; source: string; location: string; reason: string }>;
  keywordVariantMisses: Array<{ title: string; keyword: string; wouldMatch: string }>;
  crossSourceDupes: Array<{ title: string; company: string; sources: string[] }>;
  withinSourceDupes: Array<{ title: string; company: string; source: string; count: number }>;
  matchedCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

const VARIANT_MAP: Record<string, string[]> = {
  "full stack": ["fullstack", "full-stack", "full stack", "full_stack"],
  "front end": ["frontend", "front-end", "front end"],
  "back end": ["backend", "back-end", "back end"],
  "next.js": ["next.js", "nextjs", "next js"],
  "node.js": ["node.js", "nodejs", "node js"],
  "vue.js": ["vue.js", "vuejs", "vue js"],
  "nestjs": ["nestjs", "nest.js", "nest js"],
  "react": ["react", "react.js", "reactjs"],
  "express": ["express", "express.js", "expressjs"],
  "mongodb": ["mongodb", "mongo db", "mongo"],
  "postgresql": ["postgresql", "postgres", "psql"],
  "tailwind": ["tailwind", "tailwindcss", "tailwind css"],
  "typescript": ["typescript", "type script"],
  "javascript": ["javascript", "java script"],
};

async function runAnalysis() {
  const separator = "═".repeat(60);
  console.log(`\n${separator}`);
  console.log("  DATA vs CODE ANALYSIS");
  console.log(`${separator}\n`);

  // 1. Find a real user
  const userSettings = await prisma.userSettings.findFirst({
    where: { isOnboarded: true, keywords: { isEmpty: false } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!userSettings) {
    console.log("❌ No onboarded user with keywords found.");
    return;
  }

  const settings = decryptSettingsFields(userSettings);
  console.log(`User: ${settings.user.name || settings.user.email}`);
  console.log(`Keywords: ${settings.keywords.join(", ")}`);
  console.log(`City: ${settings.city || "none"} | Country: ${settings.country || "none"}`);
  console.log(`Categories: ${(settings.preferredCategories || []).join(", ") || "none"}`);
  console.log(`Platforms: ${(settings.preferredPlatforms || []).join(", ") || "all"}`);
  console.log();

  // 2. Load jobs
  const jobs = await prisma.globalJob.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  console.log(`Loaded ${jobs.length} active GlobalJobs\n`);

  const resumes = await prisma.resume.findMany({
    where: { userId: settings.userId, isDeleted: false },
    select: { id: true, name: true, content: true },
    take: 50,
  });

  console.log(`Loaded ${resumes.length} resumes\n`);

  // 3. Analyze
  const result: AnalysisResult = {
    unicodeDashJobs: [],
    nbspJobs: [],
    htmlEntityJobs: [],
    smartQuoteJobs: [],
    nullDescJobs: [],
    nullCategoryJobs: [],
    categoryMismatchJobs: [],
    locationMisses: [],
    keywordVariantMisses: [],
    crossSourceDupes: [],
    withinSourceDupes: [],
    matchedCount: 0,
    rejectedCount: 0,
    rejectionReasons: {},
  };

  // Dedup tracking
  const jobSignatures = new Map<string, { sources: string[]; title: string; company: string }>();
  const withinSourceCounts = new Map<string, number>();

  for (const job of jobs) {
    // Unicode analysis
    const allText = `${job.title} ${job.company} ${job.location || ""} ${job.description || ""}`;

    if (UNICODE_DASH_RE.test(job.title)) {
      const dashes = job.title.match(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g) || [];
      result.unicodeDashJobs.push({
        title: job.title,
        source: job.source,
        chars: dashes.map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase()}`).join(", "),
      });
    }

    for (const [field, value] of [["title", job.title], ["location", job.location], ["company", job.company]] as const) {
      if (value && NBSP_RE.test(value)) {
        result.nbspJobs.push({ title: job.title, source: job.source, field });
      }
    }

    for (const [field, value] of [["title", job.title], ["location", job.location], ["company", job.company], ["description", (job.description || "").slice(0, 200)]] as const) {
      if (value && HTML_ENTITY_RE.test(value)) {
        const match = value.match(HTML_ENTITY_RE);
        result.htmlEntityJobs.push({
          title: job.title,
          source: job.source,
          field,
          sample: match?.[0] || "",
        });
      }
    }

    if (SMART_QUOTE_RE.test(allText)) {
      result.smartQuoteJobs.push({ title: job.title, source: job.source });
    }

    // Null description
    if (!job.description || job.description.trim().length < 30) {
      result.nullDescJobs.push({ source: job.source, title: job.title });
    }

    // Null category
    if (!job.category) {
      result.nullCategoryJobs.push({ source: job.source, title: job.title });
    }

    // Category mismatch with user settings
    const userCats = (settings.preferredCategories || []).map(c => c.toLowerCase());
    if (job.category && userCats.length > 0) {
      const jobCatLower = job.category.toLowerCase();
      const directMatch = userCats.some(c => c === jobCatLower || jobCatLower.includes(c) || c.includes(jobCatLower));
      if (!directMatch) {
        result.categoryMismatchJobs.push({
          source: job.source,
          title: job.title,
          dbCategory: job.category,
        });
      }
    }

    // Cross-source duplicates
    const normKey = `${normalizeForComparison(job.title)}|${normalizeForComparison(job.company)}`;
    const existing = jobSignatures.get(normKey);
    if (existing) {
      if (!existing.sources.includes(job.source)) {
        existing.sources.push(job.source);
      }
    } else {
      jobSignatures.set(normKey, { sources: [job.source], title: job.title, company: job.company });
    }

    // Within-source duplicates
    const withinKey = `${normKey}|${job.source}`;
    withinSourceCounts.set(withinKey, (withinSourceCounts.get(withinKey) || 0) + 1);

    // Keyword variant analysis
    const titleLower = job.title.toLowerCase();
    for (const keyword of settings.keywords) {
      const kwLower = keyword.toLowerCase();
      for (const [canonical, variants] of Object.entries(VARIANT_MAP)) {
        if (kwLower === canonical || variants.includes(kwLower)) {
          for (const variant of variants) {
            if (variant !== kwLower && titleLower.includes(variant) && !titleLower.includes(kwLower)) {
              result.keywordVariantMisses.push({
                title: job.title,
                keyword: kwLower,
                wouldMatch: variant,
              });
            }
          }
        }
      }
    }

    // Run actual matching
    const match = computeMatchScore(job, settings, resumes);
    if (match.score >= MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
      result.matchedCount++;
    } else {
      result.rejectedCount++;
      const reason = match.reasons[0] || "Score too low";
      result.rejectionReasons[reason] = (result.rejectionReasons[reason] || 0) + 1;
    }

    // Location misses
    if (match.reasons.includes("Wrong location") || match.reasons.includes("Wrong country")) {
      const loc = job.location || "(null)";
      let lReason = "unknown";
      if (!job.location) lReason = "null location";
      else if (/\bpk\b/i.test(loc)) lReason = "country code not recognized";
      else if (/remote/i.test(loc)) lReason = "remote not detected";
      else lReason = "location string mismatch";
      result.locationMisses.push({ title: job.title, source: job.source, location: loc, reason: lReason });
    }
  }

  // Collect dupes
  for (const [, info] of Array.from(jobSignatures)) {
    if (info.sources.length > 1) {
      result.crossSourceDupes.push({
        title: info.title,
        company: info.company,
        sources: info.sources,
      });
    }
  }

  for (const [key, count] of Array.from(withinSourceCounts)) {
    if (count > 1) {
      const [normTitle, normCompany, source] = key.split("|");
      const orig = jobSignatures.get(`${normTitle}|${normCompany}`);
      result.withinSourceDupes.push({
        title: orig?.title || normTitle,
        company: orig?.company || normCompany,
        source,
        count,
      });
    }
  }

  // 4. Report
  const section = (title: string) => {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"─".repeat(60)}`);
  };

  // Source breakdown
  section("SOURCE BREAKDOWN");
  const bySource = new Map<string, number>();
  for (const j of jobs) bySource.set(j.source, (bySource.get(j.source) || 0) + 1);
  for (const [src, count] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src.padEnd(15)} ${count} jobs`);
  }

  // Matching summary
  section("MATCHING SUMMARY");
  console.log(`  Matched (≥${MATCH_THRESHOLDS.SHOW_ON_KANBAN}):  ${result.matchedCount}`);
  console.log(`  Rejected:           ${result.rejectedCount}`);
  console.log(`  Total:              ${jobs.length}`);
  console.log();
  console.log("  Rejection reasons:");
  for (const [reason, count] of Object.entries(result.rejectionReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason.padEnd(30)} ${count} jobs`);
  }

  // Unicode issues
  section("UNICODE ISSUES IN TITLES");
  if (result.unicodeDashJobs.length === 0) {
    console.log("  ✅ No unicode dashes found in titles");
  } else {
    console.log(`  ⚠️  ${result.unicodeDashJobs.length} titles with unicode dashes:`);
    for (const j of result.unicodeDashJobs.slice(0, 10)) {
      console.log(`    [${j.source}] "${j.title}" — ${j.chars}`);
    }
  }

  if (result.nbspJobs.length === 0) {
    console.log("  ✅ No non-breaking spaces found");
  } else {
    console.log(`  ⚠️  ${result.nbspJobs.length} fields with non-breaking spaces:`);
    for (const j of result.nbspJobs.slice(0, 10)) {
      console.log(`    [${j.source}] "${j.title}" in ${j.field}`);
    }
  }

  if (result.smartQuoteJobs.length === 0) {
    console.log("  ✅ No smart quotes found");
  } else {
    console.log(`  ⚠️  ${result.smartQuoteJobs.length} jobs with smart quotes`);
  }

  // HTML entities
  section("HTML ENTITIES IN STORED DATA");
  if (result.htmlEntityJobs.length === 0) {
    console.log("  ✅ No HTML entities found in text fields");
  } else {
    console.log(`  ⚠️  ${result.htmlEntityJobs.length} fields with HTML entities:`);
    const byField = new Map<string, number>();
    for (const j of result.htmlEntityJobs) byField.set(j.field, (byField.get(j.field) || 0) + 1);
    for (const [field, count] of Array.from(byField)) {
      console.log(`    ${field}: ${count} instances`);
    }
    for (const j of result.htmlEntityJobs.slice(0, 10)) {
      console.log(`    [${j.source}] "${j.title}" in ${j.field}: ${j.sample}`);
    }
  }

  // Description-less jobs
  section("DESCRIPTION-LESS JOBS (null or <30 chars)");
  const descBySource = new Map<string, number>();
  for (const j of result.nullDescJobs) descBySource.set(j.source, (descBySource.get(j.source) || 0) + 1);
  console.log(`  Total: ${result.nullDescJobs.length} of ${jobs.length}`);
  for (const [src, count] of Array.from(descBySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(15)} ${count}`);
  }

  // Category analysis
  section("CATEGORY ANALYSIS");
  const catBySource = new Map<string, number>();
  for (const j of result.nullCategoryJobs) catBySource.set(j.source, (catBySource.get(j.source) || 0) + 1);
  console.log(`  Null category: ${result.nullCategoryJobs.length}`);
  for (const [src, count] of Array.from(catBySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(15)} ${count}`);
  }
  console.log(`  Category mismatch with user prefs: ${result.categoryMismatchJobs.length}`);
  const mismatchCats = new Map<string, number>();
  for (const j of result.categoryMismatchJobs) {
    mismatchCats.set(j.dbCategory, (mismatchCats.get(j.dbCategory) || 0) + 1);
  }
  for (const [cat, count] of Array.from(mismatchCats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    "${cat}" ≠ user prefs  →  ${count} jobs`);
  }

  // Location misses
  section("LOCATION FILTER MISSES");
  if (result.locationMisses.length === 0) {
    console.log("  ✅ No suspicious location rejections");
  } else {
    console.log(`  ${result.locationMisses.length} jobs rejected by location:`);
    const byReason = new Map<string, number>();
    for (const j of result.locationMisses) byReason.set(j.reason, (byReason.get(j.reason) || 0) + 1);
    for (const [reason, count] of Array.from(byReason)) {
      console.log(`    ${reason.padEnd(35)} ${count}`);
    }
    for (const j of result.locationMisses.slice(0, 10)) {
      console.log(`    [${j.source}] "${j.title}" — loc: "${j.location}" (${j.reason})`);
    }
  }

  // Keyword variant misses
  section("KEYWORD VARIANT MISSES");
  if (result.keywordVariantMisses.length === 0) {
    console.log("  ✅ No variant misses detected in titles");
  } else {
    const byVariant = new Map<string, number>();
    for (const m of result.keywordVariantMisses) {
      const key = `"${m.keyword}" vs "${m.wouldMatch}"`;
      byVariant.set(key, (byVariant.get(key) || 0) + 1);
    }
    console.log(`  ${result.keywordVariantMisses.length} title-level misses:`);
    for (const [pair, count] of Array.from(byVariant.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${pair.padEnd(40)} ${count} jobs`);
    }
  }

  // Duplicates
  section("CROSS-SOURCE DUPLICATES");
  if (result.crossSourceDupes.length === 0) {
    console.log("  ✅ No cross-source duplicates found");
  } else {
    console.log(`  ${result.crossSourceDupes.length} jobs appear in multiple sources:`);
    for (const d of result.crossSourceDupes.slice(0, 15)) {
      console.log(`    "${d.title}" at ${d.company}  →  [${d.sources.join(", ")}]`);
    }
  }

  section("WITHIN-SOURCE DUPLICATES");
  if (result.withinSourceDupes.length === 0) {
    console.log("  ✅ No within-source duplicates found");
  } else {
    console.log(`  ${result.withinSourceDupes.length} duplicate groups:`);
    for (const d of result.withinSourceDupes.slice(0, 15)) {
      console.log(`    [${d.source}] "${d.title}" at ${d.company}  ×${d.count}`);
    }
  }

  // Final summary
  console.log(`\n${separator}`);
  console.log("  IMPACT SUMMARY");
  console.log(`${separator}`);
  console.log(`  Jobs loaded:              ${jobs.length}`);
  console.log(`  Currently matched:        ${result.matchedCount}`);
  console.log(`  Currently rejected:       ${result.rejectedCount}`);
  console.log(`  Unicode issues:           ${result.unicodeDashJobs.length + result.nbspJobs.length + result.smartQuoteJobs.length}`);
  console.log(`  HTML entity pollution:    ${result.htmlEntityJobs.length}`);
  console.log(`  No description:           ${result.nullDescJobs.length}`);
  console.log(`  Null category:            ${result.nullCategoryJobs.length}`);
  console.log(`  Category mismatch:        ${result.categoryMismatchJobs.length}`);
  console.log(`  Location misses:          ${result.locationMisses.length}`);
  console.log(`  Keyword variant misses:   ${result.keywordVariantMisses.length}`);
  console.log(`  Cross-source dupes:       ${result.crossSourceDupes.length}`);
  console.log(`  Within-source dupes:      ${result.withinSourceDupes.length}`);
  console.log(`${separator}\n`);
}

runAnalysis()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
