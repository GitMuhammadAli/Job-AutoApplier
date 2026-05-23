/**
 * Shared fixture profile for rendering. Used by:
 *   - scripts/build-template-thumbnails.ts (PNG thumbnail generation)
 *   - prisma/seed.ts (Hassan Tariq demo scenario)
 *
 * Keep this self-contained — it's imported from outside the runtime by Node
 * scripts, so do not pull in client-only deps.
 */

import type { ResumeProfile } from "../types";

export const FIXTURE_PROFILE: ResumeProfile = {
  id: "fixture",
  header: {
    fullName: "Jane Smith",
    headline: "Senior Software Engineer",
    email: "jane.smith@example.com",
    phone: "+1 555 0123",
    location: "San Francisco, CA",
    websiteUrl: "https://janesmith.dev",
    githubUrl: "https://github.com/janesmith",
    linkedinUrl: "https://linkedin.com/in/janesmith",
  },
  skills: [
    "TypeScript",
    "React",
    "Node.js",
    "Python",
    "Postgres",
    "AWS",
    "Docker",
    "GraphQL",
    "Redis",
    "Kubernetes",
  ],
  skillsLocked: false,
  summaries: [
    {
      id: "s1",
      label: "Default",
      content:
        "Senior engineer with 8 years building production web apps in TypeScript and Python. Shipped scaled systems serving millions of users at 3 fast-growing startups.",
      isDefault: true,
    },
  ],
  experiences: [
    {
      id: "e1",
      title: "Senior Software Engineer",
      company: "Acme Corp",
      startDate: "January 2022",
      endDate: "Present",
      bullets: [
        "Led migration of legacy monolith to Next.js + GraphQL, reducing page LCP from 4.2s to 1.6s across 12 high-traffic pages.",
        "Designed schema federation across 5 BFFs, reducing client request count by 60% and tail latency by 35%.",
        "Mentored 4 mid-level engineers; promoted 2 to senior within 18 months.",
      ],
      order: 0,
    },
    {
      id: "e2",
      title: "Software Engineer",
      company: "Beta Inc",
      startDate: "June 2019",
      endDate: "December 2021",
      bullets: [
        "Built and shipped 12 customer-facing features in TypeScript + Postgres, contributing $1.4M in tracked ARR.",
        "Drove 99.9% uptime on a service handling 2M req/day; introduced runbooks, alerting, and on-call rotation.",
      ],
      order: 1,
    },
  ],
  projects: [
    {
      id: "p1",
      title: "OpenCRDT",
      role: "Solo",
      oneLiner: "Realtime collaborative whiteboard with offline-first sync.",
      bullets: [
        "Built Yjs CRDT sync layer with conflict-free merges.",
        "WebRTC peer mesh for sub-50ms cross-tab latency.",
      ],
      stack: ["TypeScript", "Yjs", "WebRTC", "React"],
      isFeatured: true,
      order: 0,
    },
  ],
  education: [
    {
      id: "ed1",
      institution: "Massachusetts Institute of Technology",
      degree: "B.S. Computer Science",
      startDate: "2015",
      endDate: "2019",
      order: 0,
    },
  ],
  certifications: [],
};
