/**
 * JD ranker smoke test.
 *
 * Run: `npx tsx src/lib/resume/ranker.smoke.ts`
 *
 * Requires GROQ_API_KEY (and/or GOOGLE_AI_API_KEY) in env.
 *
 * Builds a fixture profile + JD, runs the ranker end-to-end, prints the
 * resulting ordering, then renders the tailored PDF HTML to /tmp.
 */

import { writeFileSync } from "node:fs";
import { rankForJd, applyRankingToRenderInput } from "./jd-ranker";
import { renderResume } from "./render";
import { buildRenderInput } from "./profile-mapper";
import type { ResumeProfile } from "./types";

const profile: ResumeProfile = {
  id: "p1",
  header: {
    fullName: "Muhammad Ali Shahid",
    headline: "Software Engineer — Full Stack",
    email: "alishahid.dev@gmail.com",
    location: "Lahore, Pakistan",
    githubUrl: "https://github.com/GitMuhammadAli",
  },
  skills: [
    "JavaScript", "TypeScript", "React", "Next.js", "Tailwind", "Node.js",
    "NestJS", "Python", "FastAPI", "PostgreSQL", "Prisma", "Redis",
    "pgvector", "Groq", "Docker", "Playwright",
  ],
  skillsLocked: false,
  summaries: [
    { id: "s1", label: "MERN-leaning", content: "Full-stack engineer with MERN background...", isDefault: true },
    { id: "s2", label: "AI-eval-leaning", content: "Engineer focused on LLM evaluation infrastructure...", isDefault: false },
    { id: "s3", label: "Backend-leaning", content: "Backend engineer with NestJS + Postgres + ...", isDefault: false },
  ],
  experiences: [
    {
      id: "e1", company: "Hubble42", title: "Software Engineer", startDate: "Aug 2025", endDate: "Present",
      bullets: ["Built full-stack features across Next.js, NestJS, and PostgreSQL with Prisma.", "Read and debug unfamiliar service code daily."],
      order: 0,
    },
  ],
  projects: [
    { id: "p1", title: "DevRadar", oneLiner: "AI interview evaluator", bullets: ["pgvector + Groq router."], stack: ["Next.js", "tRPC", "Prisma", "pgvector", "Groq"], isFeatured: true, order: 0 },
    { id: "p2", title: "JobPilot", oneLiner: "Agentic apply pipeline", bullets: ["4-agent pipeline."], stack: ["Next.js", "Prisma", "PostgreSQL", "Groq"], isFeatured: true, order: 1 },
    { id: "p3", title: "Rate-Guard", oneLiner: "LLM cost gateway", bullets: ["Redis cache, AES-256 keys."], stack: ["NestJS", "Redis", "Docker"], isFeatured: false, order: 2 },
    { id: "p4", title: "Novapulsee", oneLiner: "Multi-tenant SaaS", bullets: ["Stripe + Pinecone."], stack: ["NestJS", "MongoDB", "Stripe"], isFeatured: false, order: 3 },
    { id: "p5", title: "Portfolio", oneLiner: "Personal site", bullets: ["Framer + GSAP."], stack: ["Next.js", "Framer"], isFeatured: false, order: 4 },
  ],
  education: [
    { id: "ed1", institution: "Bahria University", degree: "BS Computer Science", startDate: "2021", endDate: "2025", order: 0 },
  ],
  certifications: [],
};

const jdText = `
Senior Python Engineer at Anthropic
Location: Remote

You'll work on:
- Python services that power our evaluation infrastructure
- FastAPI APIs for internal tooling
- pgvector-backed embedding pipelines
- Groq inference fallback chains
- Improving our LLM safety and eval rubrics

Nice to have:
- TypeScript familiarity for the frontend dashboard
- Docker experience for containerized deployment
- PostgreSQL tuning
`;

(async () => {
  console.log("→ Extracting JD signal + ranking…\n");
  const result = await rankForJd(profile, jdText, { maxProjects: 3 });

  console.log("Provider:        ", result.provider);
  console.log("Role family:     ", result.signal.roleFamily);
  console.log("Layout bias:     ", result.signal.layoutBias);
  console.log("Required:        ", result.signal.requiredSkills);
  console.log("Nice-to-have:    ", result.signal.niceSkills);
  console.log("Matched in user: ", result.ranking.matchedKeywords);
  console.log("Missing hard:    ", result.missingHardSkills);
  console.log("\nReordered skills (first 10):");
  console.log("  ", result.ranking.skillsOrder.slice(0, 10).join(", "));
  console.log("\nPicked projects:");
  for (const id of result.ranking.projectIds) {
    const p = profile.projects.find((x) => x.id === id);
    if (p) console.log(`  · ${p.title} (${p.stack.join(", ")})`);
  }
  console.log("\nPicked summary: ", profile.summaries.find((s) => s.id === result.ranking.summaryId)?.label);
  console.log("Section order:  ", result.ranking.sectionOrder.join(" → "));

  console.log("\n→ Rendering tailored PDF HTML…");
  const base = buildRenderInput(profile, { templateId: "T01", pageTarget: 1 });
  const tailored = applyRankingToRenderInput(base, profile, result.ranking);
  const render = renderResume(tailored);

  const out = "/tmp/jobpilot-resume-tailored.html";
  writeFileSync(out, render.html);
  console.log(`✓ ${out}  (audit tokens ok: ${render.auditOkTokens})`);
})().catch((err) => {
  console.error("Smoke FAIL:", err.message);
  process.exit(1);
});
