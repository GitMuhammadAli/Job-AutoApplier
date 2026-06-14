import type { ResumeProfile } from "@/lib/resume/types";

/**
 * Shared eval fixtures. Each profile is a realistic-shaped resume with
 * known content boundaries — assertions about "the rewriter shouldn't
 * introduce Kubernetes" only work if we know whether the profile has it.
 *
 * Keep these small and stable — every change ripples across eval results.
 */

export const FULLSTACK_PROFILE: ResumeProfile = {
  id: "fixture-fullstack",
  header: {
    fullName: "Jane Doe",
    headline: "Full-stack engineer — TypeScript + Postgres",
    email: "jane@example.com",
    phone: "+1-415-555-0100",
    location: "San Francisco, CA",
    websiteUrl: "https://janedoe.dev",
    githubUrl: "https://github.com/janedoe",
    linkedinUrl: "https://linkedin.com/in/janedoe",
  },
  skillsLocked: false,
  skills: [
    "TypeScript", "React", "Next.js", "Node.js", "Express",
    "PostgreSQL", "Prisma", "REST APIs", "Jest", "Git",
  ],
  summaries: [
    {
      id: "s1",
      label: "Default",
      content: "Full-stack engineer with 5 years building TypeScript SaaS apps on Next.js and Postgres. Recently shipped a multi-tenant billing system for a 50k-user product.",
      isDefault: true,
    },
  ],
  experiences: [
    {
      id: "e1",
      order: 0,
      company: "Hayward Labs",
      title: "Senior Software Engineer",
      location: "San Francisco, CA",
      startDate: "Jan 2023",
      endDate: "Present",
      bullets: [
        "Built a multi-tenant Postgres + Prisma billing service handling 50k MRR across 800 workspaces.",
        "Cut Next.js dashboard p75 load time from 4.1s to 1.2s by code-splitting and prerendering the marketing shell.",
        "Mentored 3 junior engineers through a quarterly review cycle.",
      ],
    },
    {
      id: "e2",
      order: 1,
      company: "Riverstone Software",
      title: "Software Engineer",
      location: "Remote",
      startDate: "Aug 2020",
      endDate: "Dec 2022",
      bullets: [
        "Shipped a React Native iOS + Android app used by 12k field technicians.",
        "Designed a REST API in Express + Postgres serving 4M requests/day.",
      ],
    },
  ],
  projects: [
    {
      id: "p1",
      order: 0,
      title: "Spurts",
      role: "Solo",
      oneLiner: "Open-source time tracker built on Next.js + Prisma.",
      bullets: [
        "Implemented offline-first sync with IndexedDB and conflict resolution.",
        "Published TypeScript + React component library with 200+ GitHub stars.",
      ],
      stack: ["TypeScript", "Next.js", "Prisma", "PostgreSQL"],
      liveUrl: "https://spurts.app",
      repoUrl: "https://github.com/janedoe/spurts",
      isFeatured: true,
    },
  ],
  education: [
    {
      id: "ed1",
      order: 0,
      institution: "UC Berkeley",
      degree: "B.S. Computer Science",
      startDate: "2016",
      endDate: "2020",
      details: "Graduated cum laude. Coursework in distributed systems, databases, and PL.",
    },
  ],
  certifications: [],
};

/**
 * Adversarial JD — explicitly asks for skills the candidate DOESN'T have
 * (Kubernetes, Rust, GraphQL). Used to assert the rewriter/tailor don't
 * fabricate to match the JD.
 */
export const KUBERNETES_RUST_JD = `Senior Platform Engineer

We're looking for a senior engineer to own our platform infrastructure.

Required:
- 5+ years building distributed systems in Rust or Go
- Deep Kubernetes operational experience (we run 300+ services)
- GraphQL gateway design (Apollo Federation a plus)
- Production Postgres operations at scale
- Strong TypeScript on our admin tooling

Nice to have:
- Open-source contributions
- Mentoring experience
`;

/**
 * Aligned JD — every required item maps to something in the FULLSTACK_PROFILE.
 * Used to assert positive-path tailor/fill behaviors.
 */
export const FULLSTACK_JD = `Senior Full-Stack Engineer

You'll work on our Next.js SaaS product, shipping new features end-to-end.

Required:
- 4+ years TypeScript + React
- Production Next.js experience
- Postgres + an ORM (Prisma preferred)
- REST API design

Nice to have:
- Multi-tenant SaaS background
- Mentoring or tech lead experience
- Open-source projects
`;
