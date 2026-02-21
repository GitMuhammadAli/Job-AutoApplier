/**
 * One-time fix: re-extract text and skills from resumes where content is null/empty.
 *
 * Run:  npx tsx src/scripts/fix-resume-content.ts [userId]
 *
 * Without userId: fixes ALL resumes with missing content.
 * With userId: fixes only that user's resumes.
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
import { extractText } from "../lib/resume-parser";
import { extractSkillsFromContent } from "../lib/skill-extractor";

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2] || null;

  const where: Record<string, unknown> = {
    isDeleted: false,
    OR: [
      { content: null },
      { content: "" },
    ],
  };
  if (userId) where.userId = userId;

  const resumes = await prisma.resume.findMany({
    where,
    select: { id: true, userId: true, name: true, fileName: true, fileUrl: true, fileType: true, content: true },
  });

  console.log(`Found ${resumes.length} resumes with missing content${userId ? ` for user ${userId}` : ""}\n`);

  if (resumes.length === 0) {
    console.log("Nothing to fix.");
    return;
  }

  let fixed = 0;
  let failed = 0;

  for (const resume of resumes) {
    console.log(`Processing: "${resume.name}" (${resume.fileName})`);

    if (!resume.fileUrl) {
      console.log("  SKIP: no fileUrl stored\n");
      failed++;
      continue;
    }

    try {
      const response = await fetch(resume.fileUrl);
      if (!response.ok) {
        console.log(`  FAIL: HTTP ${response.status} fetching ${resume.fileUrl}\n`);
        failed++;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = resume.fileName?.split(".").pop()?.toLowerCase() || "pdf";

      const { text, quality } = await extractText(buffer, ext);
      const skills = extractSkillsFromContent(text);

      console.log(`  Extracted: ${text.length} chars, quality=${quality}, ${skills.length} skills`);
      if (text.length > 0) {
        console.log(`  Preview: ${text.substring(0, 120).replace(/\n/g, " ")}...`);
      }
      console.log(`  Skills: ${skills.slice(0, 15).join(", ")}${skills.length > 15 ? "..." : ""}`);

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          content: text || null,
          textQuality: quality,
          detectedSkills: skills,
        },
      });

      console.log(`  FIXED\n`);
      fixed++;
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
      failed++;
    }
  }

  console.log(`\nDone: ${fixed} fixed, ${failed} failed out of ${resumes.length} total`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
