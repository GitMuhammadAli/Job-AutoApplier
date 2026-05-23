import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function mintSession(userId: string) {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId, expires } });
  return sessionToken;
}

async function main() {
  // Scenario A — Power user, 8 resumes, EMPTY structured profile (the bug)
  const ali = await prisma.user.upsert({
    where: { email: "ali@demo.com" },
    update: {},
    create: {
      email: "ali@demo.com",
      name: "Muhammad Ali Shahid",
      emailVerified: new Date(),
    },
  });
  await prisma.userSettings.upsert({
    where: { userId: ali.id },
    update: {},
    create: {
      userId: ali.id,
      phone: "+92 300 1234567",
      linkedinUrl: "https://linkedin.com/in/alishahid",
      githubUrl: "https://github.com/GitMuhammadAli",
      portfolioUrl: "https://alishahid-dev.vercel.app",
      city: "Lahore",
      country: "Pakistan",
      keywords: ["MERN", "Next.js", "React", "Node.js", "TypeScript"],
      preferredCategories: ["Full Stack Development", "Frontend Development"],
      preferredPlatforms: ["jsearch", "remotive", "linkedin"],
      experienceLevel: "Mid-Senior",
      isOnboarded: true,
    },
  });

  const resumePresets = [
    { name: "Full-Stack-2026", quality: "good", isDefault: true, withContent: true },
    { name: "Backend-Heavy", quality: "good", withContent: true },
    { name: "Frontend-React", quality: "good", withContent: true },
    { name: "MERN-Generalist", quality: "good", withContent: true },
    { name: "JavaScript-Old", quality: "low", withContent: true },
    { name: "TypeScript-Modern", quality: "good", withContent: false },
    { name: "ATS-Plain", quality: "good", withContent: false },
    { name: "General-Backup", quality: "low", withContent: false },
  ];
  const sampleContent = `MUHAMMAD ALI SHAHID
Software Engineer — Full Stack
ali@demo.com | +92 300 1234567 | Lahore, Pakistan
linkedin.com/in/alishahid | github.com/GitMuhammadAli

SUMMARY
Full-stack engineer with 4 years building production Next.js + Postgres apps. Shipped 7 SaaS products end-to-end including AI-driven job application automation, WhatsApp expense tracker, and developer market intelligence platforms.

SKILLS
Languages: TypeScript, JavaScript, Python, SQL
Frameworks: Next.js 14, React 18, NestJS, Prisma, tRPC
Cloud: Vercel, Neon Postgres, Redis, Docker
AI: OpenAI, Anthropic, Groq, Gemini, LangChain, pgvector

EXPERIENCE
Founding Engineer — Independent (2024 - Present)
- Built JobPilot: 9-source job scraper, ML scoring, 4-agent AI pipeline, encrypted SMTP
- Built Sahara: Next.js + Clerk + WhatsApp Web + pgvector RAG for Urdu expense queries
- Built DevRadar: Turborepo + tRPC + multi-provider AI router for skill trends

PROJECTS
JobPilot — AI job application automation (Next.js, Prisma, Groq)
- Reduced manual application time from 15min to 30sec per job
- 9 scrapers, 4-agent pipeline, encrypted multi-SMTP transporter pool

EDUCATION
BS Computer Science, FAST NUCES, 2020 - 2024`;

  await Promise.all(
    resumePresets.map((r) =>
      prisma.resume.upsert({
        where: { id: `seed-ali-${r.name}` },
        update: {},
        create: {
          id: `seed-ali-${r.name}`,
          userId: ali.id,
          name: r.name,
          fileName: `${r.name.toLowerCase()}.pdf`,
          fileUrl: `https://example.com/seed/${r.name}.pdf`,
          fileType: "application/pdf",
          content: r.withContent ? sampleContent : null,
          textQuality: r.quality,
          detectedSkills: r.withContent
            ? ["TypeScript", "Next.js", "React", "Node.js", "Postgres", "Prisma", "Docker", "Groq", "OpenAI"]
            : [],
          targetCategories: ["Full Stack Development"],
          isDefault: r.isDefault || false,
        },
      }),
    ),
  );

  // Scenario B — First-time user, no resumes uploaded
  const newbie = await prisma.user.upsert({
    where: { email: "newbie@demo.com" },
    update: {},
    create: {
      email: "newbie@demo.com",
      name: "Saira Ahmed",
      emailVerified: new Date(),
    },
  });
  await prisma.userSettings.upsert({
    where: { userId: newbie.id },
    update: {},
    create: {
      userId: newbie.id,
      keywords: [],
      preferredCategories: [],
      preferredPlatforms: [],
      isOnboarded: false,
    },
  });

  // Scenario C — Power user with COMPLETE structured profile
  const prepared = await prisma.user.upsert({
    where: { email: "prepared@demo.com" },
    update: {},
    create: {
      email: "prepared@demo.com",
      name: "Hassan Tariq",
      emailVerified: new Date(),
    },
  });
  await prisma.userSettings.upsert({
    where: { userId: prepared.id },
    update: {},
    create: {
      userId: prepared.id,
      fullName: "Hassan Tariq",
      phone: "+92 333 9876543",
      linkedinUrl: "https://linkedin.com/in/hassantariq",
      githubUrl: "https://github.com/hassantariq",
      portfolioUrl: "https://hassan.dev",
      city: "Karachi",
      country: "Pakistan",
      keywords: ["React", "TypeScript", "GraphQL", "AWS"],
      preferredCategories: ["Frontend Development"],
      preferredPlatforms: ["remotive", "jsearch"],
      experienceLevel: "Senior",
      resumeHeadline: "Senior Frontend Engineer — React + GraphQL",
      resumeSkills: ["React", "TypeScript", "GraphQL", "Apollo", "AWS Amplify", "Storybook", "Jest", "Cypress"],
      resumeSkillsLocked: true,
      isOnboarded: true,
    },
  });
  // All independent — run in parallel for ~5x fewer round-trips on local Postgres
  await Promise.all([
    prisma.resume.upsert({
      where: { id: "seed-prepared-main" },
      update: {},
      create: {
        id: "seed-prepared-main",
        userId: prepared.id,
        name: "Hassan-Senior-Frontend",
        fileName: "hassan-senior-frontend.pdf",
        fileUrl: "https://example.com/seed/hassan.pdf",
        fileType: "application/pdf",
        content: "Senior Frontend Engineer with 6 years...",
        textQuality: "good",
        detectedSkills: ["React", "TypeScript", "GraphQL"],
        isDefault: true,
      },
    }),
    prisma.resumeSummary.upsert({
      where: { id: "seed-prepared-summary-1" },
      update: {},
      create: {
        id: "seed-prepared-summary-1",
        userId: prepared.id,
        label: "Senior FE leaning",
        content:
          "Senior frontend engineer with 6+ years shipping React + GraphQL apps. Led migration of legacy Angular monolith to Next.js + GraphQL, cutting page LCP by 40%.",
        isDefault: true,
      },
    }),
    prisma.resumeExperience.upsert({
      where: { id: "seed-prepared-exp-1" },
      update: {},
      create: {
        id: "seed-prepared-exp-1",
        userId: prepared.id,
        company: "Acme Corp",
        title: "Senior Frontend Engineer",
        location: "Remote",
        startDate: "January 2022",
        endDate: "Present",
        bullets: [
          "Led migration of Angular 1.x SPA to Next.js 14, cutting page LCP from 4.2s to 1.6s.",
          "Designed GraphQL schema federation across 5 BFFs, reducing client requests by 60%.",
          "Mentored 4 mid-level engineers; promoted 2 to senior within 18 months.",
        ],
        order: 0,
      },
    }),
    prisma.resumeProject.upsert({
      where: { id: "seed-prepared-proj-1" },
      update: {},
      create: {
        id: "seed-prepared-proj-1",
        userId: prepared.id,
        title: "Realtime collaborative whiteboard",
        role: "Solo",
        oneLiner: "Multi-cursor Figma-style whiteboard with offline-first sync (CRDT).",
        bullets: ["Built Yjs CRDT sync layer", "WebRTC peer mesh for sub-50ms latency", "8k MAU in 6 months"],
        stack: ["React", "TypeScript", "Yjs", "WebRTC"],
        liveUrl: "https://board.hassan.dev",
        repoUrl: "https://github.com/hassantariq/board",
        isFeatured: true,
        order: 0,
      },
    }),
    prisma.resumeEducation.upsert({
      where: { id: "seed-prepared-edu-1" },
      update: {},
      create: {
        id: "seed-prepared-edu-1",
        userId: prepared.id,
        institution: "NUST",
        degree: "BS Computer Science",
        startDate: "2016",
        endDate: "2020",
        order: 0,
      },
    }),
  ]);

  // 10 realistic GlobalJob rows
  const jobs = [
    { sourceId: "rmt-001", title: "Senior Full Stack Engineer (Next.js + Postgres)", company: "Linear-Lite Inc", location: "Remote", category: "Full Stack Development", skills: ["TypeScript", "Next.js", "Postgres", "Prisma"], description: "We are hiring a Senior Full Stack Engineer to lead our Next.js 14 + Postgres stack. You will own end-to-end features from schema design through deployed UI. Required: 4+ years TypeScript, deep Next.js App Router experience, strong Postgres including migrations and query tuning. Nice to have: Prisma, Vercel deploys, AI integrations." },
    { sourceId: "rmt-002", title: "Frontend Engineer — React + GraphQL", company: "DataLayer Co", location: "Remote", category: "Frontend Development", skills: ["React", "TypeScript", "GraphQL", "Apollo"], description: "Senior Frontend Engineer to own our customer-facing React + GraphQL dashboard. 5+ years React, deep TypeScript, GraphQL schema design, Apollo Client cache management. Bonus: design systems, Storybook, performance optimization (LCP/FID/CLS)." },
    { sourceId: "rmt-003", title: "Backend Engineer — NestJS + Postgres", company: "Stripe-Alternative", location: "Remote", category: "Backend Development", skills: ["NestJS", "Postgres", "Redis", "Docker"], description: "Backend engineer to build our payments API. NestJS, Postgres, Redis, Docker. You will design idempotent webhook handlers, distributed locks, and high-throughput transaction pipelines. 3+ years backend production experience required." },
    { sourceId: "jsr-004", title: "AI Engineer — RAG + Agents", company: "Conversant AI", location: "Remote", category: "AI/ML", skills: ["Python", "LangChain", "pgvector", "OpenAI"], description: "AI Engineer to ship our RAG + multi-agent platform. Strong Python, LangChain, pgvector or Pinecone, OpenAI/Anthropic API. You will design retrieval pipelines, agent orchestration, evals. Bonus: LangGraph, DSPy, multi-modal." },
    { sourceId: "lnk-005", title: "Senior React Engineer — Design Systems", company: "Loom-Like Co", location: "San Francisco", category: "Frontend Development", skills: ["React", "TypeScript", "Storybook", "CSS-in-JS"], description: "Senior engineer on our Design Systems team. 5+ years React, deep TypeScript, design tokens, accessibility (WCAG), Storybook. Bonus: working with designers on component API design." },
    { sourceId: "rmt-006", title: "DevOps Engineer — Kubernetes", company: "Infra-Tools", location: "Remote", category: "DevOps", skills: ["Kubernetes", "Terraform", "AWS", "Go"], description: "DevOps engineer to own our K8s clusters across AWS regions. Terraform, Helm, observability stack (Prometheus, Loki, Grafana). 3+ years Kubernetes production." },
    { sourceId: "jsr-007", title: "Junior Frontend Developer", company: "Pakistan StartupX", location: "Lahore, Pakistan", category: "Frontend Development", skills: ["React", "JavaScript", "CSS"], description: "Entry-level frontend developer. 0-2 years experience. React, JavaScript, HTML/CSS. We provide mentorship and growth path to senior in 3 years." },
    { sourceId: "rmt-008", title: "Staff Engineer — Platform", company: "ScaleCo", location: "Remote", category: "Backend Development", skills: ["Go", "Kafka", "Postgres", "DDD"], description: "Staff engineer to lead our platform group. 8+ years backend, Go production, distributed systems (Kafka, sagas), Domain-Driven Design. You will set architectural direction across 4 product teams." },
    { sourceId: "rmt-009", title: "Full Stack Engineer — Hacker Mindset", company: "Tiny SaaS Inc", location: "Remote", category: "Full Stack Development", skills: ["Next.js", "Stripe", "Postgres"], description: "Generalist who ships. Founder-mode. Next.js, Stripe billing, Postgres. You will own features end-to-end from idea to shipped to customer feedback. 3+ years shipping production." },
    { sourceId: "lnk-010", title: "Senior TypeScript Engineer (Open Source)", company: "DevTools Co", location: "Remote", category: "Full Stack Development", skills: ["TypeScript", "Node.js", "AST", "Compiler"], description: "Work on our open-source TypeScript tooling. Deep TypeScript including type-level programming, AST manipulation, compiler internals. 5+ years TypeScript including library/tool authoring." },
  ];

  await Promise.all(
    jobs.map((j) =>
      prisma.globalJob.upsert({
        where: { sourceId_source: { sourceId: j.sourceId, source: "seed" } },
        update: {},
        create: {
          sourceId: j.sourceId,
          source: "seed",
          title: j.title,
          company: j.company,
          location: j.location,
          category: j.category,
          skills: j.skills,
          description: j.description,
          postedDate: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
          applyUrl: `https://example.com/apply/${j.sourceId}`,
          isActive: true,
          isFresh: true,
        },
      }),
    ),
  );

  // Link ali@demo.com to 5 jobs (varied stages + match scores) — batch the
  // findUnique lookups so we issue 1 round-trip instead of N
  const aliSourceIds = ["rmt-001", "rmt-002", "rmt-003", "jsr-004", "rmt-009"];
  const preparedSourceIds = ["rmt-002", "lnk-005"];
  const allLinkedJobs = await prisma.globalJob.findMany({
    where: {
      source: "seed",
      sourceId: { in: Array.from(new Set([...aliSourceIds, ...preparedSourceIds])) },
    },
  });
  const jobBySourceId = new Map(allLinkedJobs.map((gj) => [gj.sourceId, gj]));

  await Promise.all(
    aliSourceIds.flatMap((sid) => {
      const gj = jobBySourceId.get(sid);
      if (!gj) return [];
      return [
        prisma.userJob.upsert({
          where: { userId_globalJobId: { userId: ali.id, globalJobId: gj.id } },
          update: {},
          create: {
            userId: ali.id,
            globalJobId: gj.id,
            stage: "SAVED",
            matchScore: 70 + Math.random() * 25,
            matchReasons: ["Strong TypeScript overlap", "Next.js experience matches", "Postgres in your skill set"],
            isBookmarked: sid === "rmt-001",
          },
        }),
      ];
    }),
  );

  await Promise.all(
    preparedSourceIds.flatMap((sid) => {
      const gj = jobBySourceId.get(sid);
      if (!gj) return [];
      return [
        prisma.userJob.upsert({
          where: { userId_globalJobId: { userId: prepared.id, globalJobId: gj.id } },
          update: {},
          create: {
            userId: prepared.id,
            globalJobId: gj.id,
            stage: "SAVED",
            matchScore: 85 + Math.random() * 10,
            matchReasons: ["React + GraphQL match", "Senior FE experience"],
          },
        }),
      ];
    }),
  );

  // Mint sessions so we can log in by setting a cookie
  const aliSession = await mintSession(ali.id);
  const newbieSession = await mintSession(newbie.id);
  const preparedSession = await mintSession(prepared.id);

  console.log("\n=== Seed complete ===\n");
  console.log("Scenario A — power user with empty profile (the bug):");
  console.log(`  email: ali@demo.com    sessionToken: ${aliSession}`);
  console.log("Scenario B — first-time user, no resumes:");
  console.log(`  email: newbie@demo.com sessionToken: ${newbieSession}`);
  console.log("Scenario C — fully-prepared user:");
  console.log(`  email: prepared@demo.com sessionToken: ${preparedSession}`);
  console.log("\nLog in by setting cookie 'next-auth.session-token' to the token above.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
