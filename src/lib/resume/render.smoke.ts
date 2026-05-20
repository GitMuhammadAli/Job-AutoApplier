/**
 * Smoke test for the resume render pipeline.
 *
 * Run: `npx tsx src/lib/resume/render.smoke.ts`
 *
 * Loads a fixture render input, calls renderResume, writes the HTML to
 * /tmp/jobpilot-resume-smoke.html, and prints the audit summary.
 *
 * Hand-runnable proof that:
 *   - The Zod schema accepts a real-shaped input.
 *   - The template renderer produces a complete HTML doc.
 *   - The anti-fabrication audit passes for legitimate data.
 *
 * This file is excluded from production bundles by being .smoke.ts (not .ts).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { renderResume } from "./render";
import type { ResumeRenderInput } from "./types";

const fixture: ResumeRenderInput = {
  templateId: "T01",
  templateVersion: "T01@1.0.0",
  pageTarget: 1,
  header: {
    fullName: "Muhammad Ali Shahid",
    headline: "Software Engineer — LLM Evaluation & Agentic Systems",
    location: "Lahore, Pakistan",
    email: "alishahid.dev@gmail.com",
    phone: "+92 336 7749668",
    githubUrl: "https://github.com/GitMuhammadAli",
    linkedinUrl: "https://linkedin.com/in/alishahid-fswebdev",
  },
  summary: {
    content:
      "Software engineer focused on LLM evaluation infrastructure — agentic harnesses, multi-provider routers with cost-aware fallback, and structured rubric scorers for AI output.",
    sourceId: "sum_ai_eval",
  },
  skills: [
    "TypeScript", "JavaScript", "Python", "SQL",
    "Groq", "Gemini", "Anthropic Claude", "OpenAI",
    "Next.js", "NestJS", "React", "Tailwind CSS",
    "PostgreSQL", "Prisma", "Redis", "pgvector",
    "Docker", "Playwright", "Turborepo", "Vitest",
  ],
  experiences: [
    {
      sourceId: "exp_hubble42",
      company: "Hubble42",
      title: "Software Engineer",
      location: "Lahore",
      startDate: "August 2025",
      endDate: "Present",
      bullets: [
        "Build full-stack features across Next.js, NestJS, and PostgreSQL with Prisma; design and verify REST APIs with JWT/RBAC; integrate payment gateways, SMTP providers, and AI APIs.",
        "Read and debug unfamiliar service code daily, run integration tests, validate behavior against staging and production environments.",
      ],
    },
  ],
  projects: [
    {
      sourceId: "prj_devradar",
      title: "DevRadar",
      role: "Solo",
      oneLiner: "Career intelligence with AI interview evaluation and skill trends",
      bullets: [
        "AI interview evaluator with structured rubric scoring across five phases; 67 unit tests in CI covering rubric edge cases.",
        "Multi-provider LLM router with cost-aware fallback from Groq to Gemini.",
      ],
      stack: ["Next.js", "tRPC", "Prisma", "pgvector", "Groq"],
      liveUrl: "https://dev-radar-web.vercel.app",
      repoUrl: "https://github.com/GitMuhammadAli/Dev-Radar",
    },
    {
      sourceId: "prj_jobpilot",
      title: "JobPilot",
      role: "Solo",
      oneLiner: "Agentic job-application pipeline that drafts and sends from your Gmail",
      bullets: [
        "Four-agent pipeline: company research, resume tailor, email writer, QA checker.",
        "Nine source scrapers with per-source health diagnostics and circuit-breaker for flaky sources.",
      ],
      stack: ["Next.js", "Prisma", "PostgreSQL", "Groq"],
      liveUrl: "https://job-auto-applier-three.vercel.app",
      repoUrl: "https://github.com/GitMuhammadAli/Job-AutoApplier",
    },
  ],
  education: [
    {
      sourceId: "edu_bahria",
      institution: "Bahria University",
      degree: "Bachelor of Science in Computer Science",
      startDate: "2021",
      endDate: "2025",
    },
  ],
  certifications: [],
  sectionOrder: ["summary", "skills", "experience", "projects", "education"],
};

const result = renderResume(fixture);

mkdirSync("/tmp", { recursive: true });
const outPath = "/tmp/jobpilot-resume-smoke.html";
writeFileSync(outPath, result.html);

console.log(`✓ Rendered: ${outPath}`);
console.log(`  templateId:      ${result.templateId}`);
console.log(`  templateVersion: ${result.templateVersion}`);
console.log(`  audit tokens:    ${result.auditOkTokens} (all traced to input)`);
console.log(`\nOpen with: open ${outPath}`);
