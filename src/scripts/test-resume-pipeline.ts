/**
 * Full resume pipeline test — tests extraction, parsing, skills, quality,
 * matching against sample jobs, and AI rephrase readiness.
 * Usage: npx tsx src/scripts/test-resume-pipeline.ts [path-to-pdf]
 */
import fs from "fs";
import path from "path";
import { extractTextFromPDF } from "../lib/resume-parser";
import { parseResume, extractSkillsFromContent } from "../lib/skill-extractor";
import { computeMatchScore } from "../lib/matching/score-engine";

const PDF_PATH = process.argv[2] || "Full-stack-Ali-Shahid.pdf";

const SAMPLE_JOBS = [
  {
    title: "Full Stack Developer",
    company: "TechCorp",
    location: "Remote",
    description: "Looking for a Full Stack Developer with experience in React, Next.js, Node.js, and PostgreSQL. Must have experience with Docker and CI/CD pipelines.",
    salary: "$80,000 - $120,000",
    jobType: "Full-time",
    experienceLevel: "Mid-Level",
    category: "Software Development",
    skills: ["React", "Next.js", "Node.js", "PostgreSQL", "Docker", "TypeScript"],
    source: "test",
    isFresh: true,
    firstSeenAt: new Date(),
  },
  {
    title: "Frontend React Developer",
    company: "WebAgency",
    location: "New York, NY",
    description: "Join our team building modern web apps with React, Tailwind CSS, and TypeScript. Experience with REST APIs required.",
    salary: null,
    jobType: "Full-time",
    experienceLevel: "Junior",
    category: "Frontend Development",
    skills: ["React", "Tailwind CSS", "TypeScript", "REST"],
    source: "test",
    isFresh: true,
    firstSeenAt: new Date(),
  },
  {
    title: "Backend Engineer (Python/Django)",
    company: "DataPipeline Inc",
    location: "London, UK",
    description: "Senior Backend Engineer to build data pipelines using Python, Django, and AWS services. 5+ years experience required.",
    salary: "£70,000 - £90,000",
    jobType: "Full-time",
    experienceLevel: "Senior",
    category: "Backend Development",
    skills: ["Python", "Django", "AWS", "PostgreSQL", "Redis"],
    source: "test",
    isFresh: true,
    firstSeenAt: new Date(),
  },
  {
    title: "MERN Stack Developer",
    company: "StartupXYZ",
    location: "Remote",
    description: "Building SaaS platform using MongoDB, Express, React, Node.js. Experience with NestJS, Docker, and Vercel deployment is a plus.",
    salary: "$60,000 - $90,000",
    jobType: "Full-time",
    experienceLevel: "Mid-Level",
    category: "Full Stack Development",
    skills: ["MongoDB", "Express", "React", "Node.js", "NestJS", "Docker"],
    source: "test",
    isFresh: true,
    firstSeenAt: new Date(),
  },
  {
    title: "DevOps Engineer",
    company: "CloudOps",
    location: "Remote",
    description: "Manage CI/CD pipelines, Docker containers, and cloud infrastructure. Experience with GitHub Actions, Kubernetes required.",
    salary: null,
    jobType: "Contract",
    experienceLevel: "Senior",
    category: "DevOps",
    skills: ["Docker", "Kubernetes", "GitHub Actions", "AWS", "Terraform"],
    source: "test",
    isFresh: true,
    firstSeenAt: new Date(),
  },
];

const MOCK_USER_SETTINGS = {
  keywords: ["React", "Next.js", "Node.js", "Full Stack", "MERN"],
  city: null,
  country: null,
  experienceLevel: "Mid-Level",
  workType: ["Remote", "Hybrid"],
  jobType: ["Full-time"],
  preferredCategories: ["Software Development", "Full Stack Development", "Frontend Development"],
  preferredPlatforms: [],
  salaryMin: null,
  salaryMax: null,
  blacklistedCompanies: [],
};

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   RESUME PIPELINE — FULL END-TO-END TEST        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── STEP 1: Read PDF ──
  if (!fs.existsSync(PDF_PATH)) {
    console.error("File not found:", PDF_PATH);
    process.exit(1);
  }
  const buf = fs.readFileSync(PDF_PATH);
  console.log("STEP 1: PDF FILE");
  console.log(`  Path:  ${PDF_PATH}`);
  console.log(`  Size:  ${buf.length.toLocaleString()} bytes`);
  console.log(`  Valid: ${buf[0] === 0x25 && buf[1] === 0x50 ? "Yes (PDF header %%PDF)" : "No — not a valid PDF"}`);
  console.log("");

  // ── STEP 2: extractTextFromPDF (exact same function the API uses) ──
  console.log("STEP 2: TEXT EXTRACTION (using extractTextFromPDF — same as API)");
  const { text, quality } = await extractTextFromPDF(buf);
  console.log(`  Chars extracted: ${text.length.toLocaleString()}`);
  console.log(`  Quality:         ${quality}`);
  console.log(`  Preview:         ${text.substring(0, 120).replace(/\n/g, " ")}...`);
  if (text.length < 20) {
    console.log("  ❌ CRITICAL: Not enough text. Pipeline would fail.");
    process.exit(1);
  }
  console.log("");

  // ── STEP 3: parseResume (structured parsing + skill extraction) ──
  console.log("STEP 3: STRUCTURED RESUME PARSING (parseResume)");
  const parsed = parseResume(text);
  console.log(`  Skills detected:     ${parsed.skills.length}`);
  console.log(`  Skills list:         ${parsed.skills.join(", ")}`);
  console.log(`  Years of experience: ${parsed.yearsOfExperience ?? "not detected"}`);
  console.log(`  Education level:     ${parsed.educationLevel ?? "not detected"}`);
  console.log(`  Sections:`);
  for (const [key, val] of Object.entries(parsed.sections)) {
    const len = (val as string).length;
    console.log(`    ${key.padEnd(16)} ${len > 0 ? `${len} chars` : "— empty"}`);
  }
  console.log("");

  // ── STEP 4: extractSkillsFromContent (standalone, used in updateResumeText) ──
  console.log("STEP 4: STANDALONE SKILL EXTRACTION (extractSkillsFromContent)");
  const standaloneSkills = extractSkillsFromContent(text, parsed.sections.skills);
  console.log(`  Skills found: ${standaloneSkills.length}`);
  console.log(`  Match parseResume output: ${standaloneSkills.length === parsed.skills.length ? "✅ Yes" : "❌ No"}`);
  console.log("");

  // ── STEP 5: Simulated upload API result ──
  console.log("STEP 5: SIMULATED UPLOAD (what POST /api/resumes/upload would save)");
  const uploadResult = {
    content: text,
    textQuality: quality,
    detectedSkills: parsed.skills,
    fileName: path.basename(PDF_PATH),
    fileType: "application/pdf",
    needsManualText: quality === "poor" || quality === "empty",
    targetCategories: [] as string[],
  };
  console.log(`  fileName:        ${uploadResult.fileName}`);
  console.log(`  content length:  ${uploadResult.content.length} chars`);
  console.log(`  textQuality:     ${uploadResult.textQuality}`);
  console.log(`  needsManualText: ${uploadResult.needsManualText}`);
  console.log(`  detectedSkills:  [${uploadResult.detectedSkills.length} skills]`);
  console.log("");

  // ── STEP 6: Job matching with score engine ──
  console.log("STEP 6: JOB MATCHING (computeMatchScore vs 5 sample jobs)");
  console.log("─".repeat(75));
  console.log(
    "  " +
      "Job Title".padEnd(35) +
      "Score".padEnd(8) +
      "Skills Overlap".padEnd(18) +
      "Reasons"
  );
  console.log("─".repeat(75));

  const resumeForMatching = {
    id: "test-resume-id",
    content: text,
    name: path.basename(PDF_PATH, ".pdf"),
    detectedSkills: parsed.skills,
  };

  const matchResults: Array<{ title: string; score: number; reasons: string[] }> = [];
  for (const job of SAMPLE_JOBS) {
    const result = computeMatchScore(
      job,
      MOCK_USER_SETTINGS,
      [resumeForMatching],
    );
    const overlap = job.skills.filter((s) =>
      parsed.skills.some((ps) => ps.toLowerCase() === s.toLowerCase())
    );
    matchResults.push({ title: job.title, score: result.score, reasons: result.reasons });
    console.log(
      "  " +
        `${job.title} (${job.company})`.padEnd(35) +
        `${result.score}`.padEnd(8) +
        `${overlap.length}/${job.skills.length} (${overlap.join(", ")})`.padEnd(18)
    );
    if (result.reasons.length > 0) {
      for (const r of result.reasons.slice(0, 3)) {
        console.log(`    → ${r}`);
      }
    }
  }
  console.log("─".repeat(75));
  console.log("");

  // ── STEP 7: AI Rephrase readiness ──
  console.log("STEP 7: AI REPHRASE READINESS");
  if (text.length >= 50) {
    const promptPreview = text.slice(0, 200).replace(/\n/g, " ");
    console.log(`  ✅ Content is ${text.length} chars — ready for AI Rephrase`);
    console.log(`  Would send first ${Math.min(text.length, 8000)} chars to Groq`);
    console.log(`  Prompt preview: "${promptPreview}..."`);
  } else {
    console.log("  ❌ Not enough content for AI Rephrase");
  }
  console.log("");

  // ── STEP 8: Re-parse simulation (reExtractResume path) ──
  console.log("STEP 8: RE-PARSE SIMULATION (reExtractResume path)");
  const reExtract = await extractTextFromPDF(buf);
  const reParsed = parseResume(reExtract.text);
  console.log(`  Re-extracted: ${reExtract.text.length} chars (quality: ${reExtract.quality})`);
  console.log(`  Re-parsed skills: ${reParsed.skills.length}`);
  console.log(`  Consistent with initial: ${reParsed.skills.length === parsed.skills.length ? "✅ Yes" : "❌ No"}`);
  console.log("");

  // ── SUMMARY ──
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   RESULTS SUMMARY                                ║");
  console.log("╚══════════════════════════════════════════════════╝");
  const highMatchJobs = matchResults.filter((r) => r.score >= 40);
  const checks = [
    { name: "PDF read & valid", pass: buf.length > 0 && buf[0] === 0x25 },
    { name: "Text extraction (pdfjs-dist)", pass: text.length >= 100 },
    { name: "Text quality = good", pass: quality === "good" },
    { name: "Skills detected (>5)", pass: parsed.skills.length > 5 },
    { name: "Summary section", pass: parsed.sections.summary.length > 0 },
    { name: "Experience section", pass: parsed.sections.experience.length > 0 },
    { name: "Education section", pass: parsed.sections.education.length > 0 },
    { name: "Skills section", pass: parsed.sections.skills.length > 0 },
    { name: "Projects section", pass: parsed.sections.projects.length > 0 },
    { name: "Years of experience", pass: parsed.yearsOfExperience !== null },
    { name: "Education level", pass: parsed.educationLevel !== null },
    { name: "Job matching works", pass: matchResults.every((r) => r.score >= 0) },
    { name: "Relevant jobs scored >40", pass: highMatchJobs.length >= 2 },
    { name: "Irrelevant job scored lower", pass: (matchResults.find((r) => r.title.includes("Python"))?.score ?? 100) < (matchResults.find((r) => r.title.includes("Full Stack"))?.score ?? 0) },
    { name: "Re-parse consistent", pass: reParsed.skills.length === parsed.skills.length },
    { name: "AI Rephrase ready", pass: text.length >= 50 },
    { name: "Upload needsManualText = false", pass: !uploadResult.needsManualText },
  ];

  let passed = 0;
  for (const c of checks) {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
    if (c.pass) passed++;
  }
  console.log(`\n  Score: ${passed}/${checks.length} checks passed`);
  console.log(
    passed === checks.length
      ? "\n  🎉 ALL CHECKS PASSED — Full pipeline is working end-to-end!"
      : `\n  ⚠️  ${checks.length - passed} check(s) need attention`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
