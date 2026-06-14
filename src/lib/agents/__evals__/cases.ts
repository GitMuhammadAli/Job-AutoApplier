/**
 * Eval cases — what the agents must satisfy on the fixture profiles.
 *
 * These run a live LLM call against fixed inputs. Catch regressions like
 * "tailor started fabricating skills after a prompt rewrite" or "rewriter
 * leaks 'Kubernetes' into bullets that didn't have it" before they hit
 * users.
 *
 * Runner: src/lib/agents/__evals__/run.ts — iterates `EVAL_CASES` and
 * prints pass/fail. Designed for nightly CI, not per-PR (each case costs
 * ~1¢ + ~5s wall-clock).
 */

import { z } from "zod";
import { tailorResume, type TailoredResume } from "@/lib/agents/resume-tailor";
import { rewriteResume, type RewriteResult } from "@/lib/agents/resume-rewriter";
import {
  FULLSTACK_PROFILE,
  KUBERNETES_RUST_JD,
  FULLSTACK_JD,
} from "./fixtures/profiles";
import type { AgentEvalCase } from "./types";

const TailoredShape = z.object({
  relevantSkills: z.array(z.string()),
  adjacentMatches: z.array(z.object({
    jdAsks: z.string(),
    userHas: z.string(),
    honest: z.boolean(),
  })),
  bulletSuggestions: z.array(z.string()),
  missingKeywords: z.array(z.string()),
}) satisfies z.ZodType<TailoredResume>;

const RewriteShape = z.object({
  rewrittenSummary: z.string().nullable(),
  rewrittenBullets: z.instanceof(Map),
  rewrittenSkillLabels: z.instanceof(Map),
  auditResult: z.object({
    passed: z.boolean(),
    hardFabrications: z.array(z.string()),
    numberFabrications: z.array(z.string()),
    dateMismatches: z.array(z.string()),
    softWarnings: z.array(z.string()),
  }),
  warnings: z.array(z.string()),
}) as unknown as z.ZodType<RewriteResult>;

// Words the FULLSTACK_PROFILE doesn't contain — fabrications would surface
// these in the rewriter output. Keep lower-cased + word-boundary friendly.
const FORBIDDEN_TERMS = [
  "kubernetes", "k8s", "rust", "go ", "golang", "graphql", "apollo",
  "rocket", "tokio", "kafka", "redis",
];

function containsForbidden(text: string): string[] {
  const lc = text.toLowerCase();
  return FORBIDDEN_TERMS.filter((t) => lc.includes(t));
}

export const EVAL_CASES: Array<AgentEvalCase<any>> = [
  // ── Tailor ───────────────────────────────────────────────────────
  {
    id: "tailor.no-fabrication.kubernetes-rust-jd",
    name: "Tailor: doesn't fabricate skills the candidate lacks",
    description: "JD demands Kubernetes, Rust, GraphQL — none in profile. relevantSkills must be a subset of user skills.",
    run: async () => tailorResume({
      userSkills: FULLSTACK_PROFILE.skills,
      jobDescription: KUBERNETES_RUST_JD,
      jobTitle: "Senior Platform Engineer",
    }),
    shape: TailoredShape,
    assertions: [
      {
        name: "relevantSkills is subset of profile skills",
        check: (out) => {
          const o = out as TailoredResume;
          const profile = new Set(FULLSTACK_PROFILE.skills.map((s) => s.toLowerCase()));
          const leaks = o.relevantSkills.filter((s) => !profile.has(s.toLowerCase()));
          return leaks.length === 0
            ? { ok: true }
            : { ok: false, message: `Fabricated skills: ${leaks.join(", ")}` };
        },
      },
      {
        name: "missingKeywords includes 'kubernetes'",
        check: (out) => {
          const o = out as TailoredResume;
          const has = o.missingKeywords.some((k) => k.toLowerCase().includes("kubernetes") || k.toLowerCase().includes("k8s"));
          return has
            ? { ok: true }
            : { ok: false, message: "Expected 'kubernetes' / 'k8s' in missingKeywords" };
        },
      },
    ],
  } as AgentEvalCase<TailoredResume>,
  {
    id: "tailor.aligned-jd-picks-real-skills",
    name: "Tailor: aligned JD surfaces real overlap",
    description: "JD asks for TypeScript/React/Next/Postgres/Prisma — all in profile. relevantSkills should cover ≥3 of those.",
    run: async () => tailorResume({
      userSkills: FULLSTACK_PROFILE.skills,
      jobDescription: FULLSTACK_JD,
      jobTitle: "Senior Full-Stack Engineer",
    }),
    shape: TailoredShape,
    assertions: [
      {
        name: "Picks ≥3 of TS/React/Next/Postgres/Prisma",
        check: (out) => {
          const o = out as TailoredResume;
          const want = ["typescript", "react", "next.js", "postgresql", "prisma"];
          const picked = o.relevantSkills.map((s) => s.toLowerCase());
          const hits = want.filter((w) => picked.some((p) => p.includes(w)));
          return hits.length >= 3
            ? { ok: true }
            : { ok: false, message: `Only matched ${hits.length}/5 expected skills` };
        },
      },
    ],
  } as AgentEvalCase<TailoredResume>,

  // ── Rewriter ─────────────────────────────────────────────────────
  {
    id: "rewriter.no-fabrication.kubernetes-jd",
    name: "Rewriter: doesn't leak JD vocab the profile lacks",
    description: "Even when JD pushes Kubernetes/Rust/GraphQL, the rewriter's output must not contain those terms.",
    run: async () => {
      const tailored = await tailorResume({
        userSkills: FULLSTACK_PROFILE.skills,
        jobDescription: KUBERNETES_RUST_JD,
        jobTitle: "Senior Platform Engineer",
      });
      return rewriteResume({
        profile: FULLSTACK_PROFILE,
        tailored,
        jdText: KUBERNETES_RUST_JD,
      });
    },
    shape: RewriteShape,
    assertions: [
      {
        name: "audit passed (no hard fabrications)",
        check: (out) => {
          const o = out as RewriteResult;
          return o.auditResult.passed
            ? { ok: true }
            : { ok: false, message: `Audit flagged: ${o.auditResult.hardFabrications.join(", ")}` };
        },
      },
      {
        name: "no forbidden term appears in any rewritten bullet",
        check: (out) => {
          const o = out as RewriteResult;
          const offenders: string[] = [];
          o.rewrittenBullets.forEach((rewritten, original) => {
            const bad = containsForbidden(rewritten);
            if (bad.length > 0) offenders.push(`"${original.slice(0, 40)}…" leaked ${bad.join(",")}`);
          });
          return offenders.length === 0
            ? { ok: true }
            : { ok: false, message: offenders.join(" | ") };
        },
      },
      {
        name: "no forbidden term appears in rewritten summary",
        check: (out) => {
          const o = out as RewriteResult;
          if (!o.rewrittenSummary) return { ok: true };
          const bad = containsForbidden(o.rewrittenSummary);
          return bad.length === 0
            ? { ok: true }
            : { ok: false, message: `Summary leaked: ${bad.join(",")}` };
        },
      },
    ],
  } as AgentEvalCase<RewriteResult>,
];
