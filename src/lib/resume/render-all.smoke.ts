/**
 * Multi-template smoke test.
 *
 * Renders the same fixture profile through every `available: true` template
 * and writes the HTML to /tmp. Use for visual comparison.
 *
 * Run: `npx tsx src/lib/resume/render-all.smoke.ts`
 */

import { writeFileSync } from "node:fs";
import { renderResume } from "./render";
import { buildRenderInput } from "./profile-mapper";
import { getAvailableTemplates } from "./templates/registry";
import type { ResumeProfile } from "./types";

const profile: ResumeProfile = {
  id: "p1",
  header: {
    fullName: "Muhammad Ali Shahid",
    headline: "Software Engineer — Full Stack",
    email: "alishahid.dev@gmail.com",
    phone: "+92 336 7749668",
    location: "Lahore, Pakistan",
    githubUrl: "https://github.com/GitMuhammadAli",
    linkedinUrl: "https://linkedin.com/in/alishahid-fswebdev",
  },
  skills: [
    "TypeScript", "JavaScript", "Python", "React", "Next.js", "Node.js",
    "NestJS", "PostgreSQL", "Prisma", "Docker", "Groq", "pgvector",
  ],
  skillsLocked: false,
  summaries: [
    {
      id: "s1",
      label: "Default",
      content:
        "Software engineer with experience across MERN, NestJS, and LLM evaluation infrastructure. Strong at reading unfamiliar codebases, debugging multi-process systems, and writing structured rubric scorers.",
      isDefault: true,
    },
  ],
  experiences: [
    {
      id: "e1",
      company: "Hubble42",
      title: "Software Engineer",
      location: "Lahore",
      startDate: "August 2025",
      endDate: "Present",
      bullets: [
        "Build full-stack features across Next.js, NestJS, and PostgreSQL with Prisma; design and verify REST APIs with JWT/RBAC.",
        "Read and debug unfamiliar service code daily, run integration tests, validate behavior against staging and production environments.",
      ],
      order: 0,
    },
    {
      id: "e2",
      company: "NgXoft Solutions",
      title: "Software Engineer",
      location: "Lahore",
      startDate: "October 2024",
      endDate: "August 2025",
      bullets: [
        "Built React + Tailwind frontends and NestJS / PostgreSQL backends for production client work.",
        "Containerized services with Docker, deployed to Vercel and self-hosted VPS, contributed to GitHub Actions CI/CD pipelines.",
      ],
      order: 1,
    },
  ],
  projects: [
    {
      id: "p1",
      title: "DevRadar",
      role: "Solo",
      oneLiner: "Career intelligence with AI interview evaluation and skill trends",
      bullets: [
        "AI interview evaluator with structured rubric scoring; 67 unit tests in CI covering rubric edge cases.",
        "Multi-provider LLM router with cost-aware fallback from Groq to Gemini.",
      ],
      stack: ["Next.js", "tRPC", "Prisma", "pgvector", "Groq"],
      liveUrl: "https://dev-radar-web.vercel.app",
      repoUrl: "https://github.com/GitMuhammadAli/Dev-Radar",
      isFeatured: true,
      order: 0,
    },
  ],
  education: [
    {
      id: "ed1",
      institution: "Bahria University",
      degree: "Bachelor of Science in Computer Science",
      startDate: "2021",
      endDate: "2025",
      order: 0,
    },
  ],
  certifications: [],
};

console.log(`Rendering ${getAvailableTemplates().length} available templates…\n`);

let allOk = true;
for (const tpl of getAvailableTemplates()) {
  try {
    const input = buildRenderInput(profile, { templateId: tpl.id, pageTarget: 1 });
    const result = renderResume(input);
    const out = `/tmp/jobpilot-resume-${tpl.id}.html`;
    writeFileSync(out, result.html);
    console.log(`✓ ${tpl.id}  ${tpl.name.padEnd(28)}  ${result.auditOkTokens} tokens  → ${out}`);
  } catch (err) {
    allOk = false;
    console.error(`✗ ${tpl.id}  ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (!allOk) process.exit(1);
console.log("\nAll templates rendered, all audits passed.");
console.log("Compare side-by-side with:  open /tmp/jobpilot-resume-T01.html /tmp/jobpilot-resume-T02.html /tmp/jobpilot-resume-T03.html /tmp/jobpilot-resume-T04.html");
