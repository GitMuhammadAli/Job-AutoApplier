/**
 * Eval harness shared types.
 *
 * Each fixture has inputs (JD + profile snippet), expected invariants (Zod
 * schemas the agent's output must satisfy), and named assertions (functions
 * that get the output + return ok/fail). Assertions are agent-specific —
 * "the rewriter must NOT introduce 'Kubernetes' when the profile has no
 * k8s" — and live next to each fixture so they evolve together.
 *
 * Runner: src/lib/agents/__evals__/run.ts. Invoked locally via
 * `npm run eval`, in CI via the nightly-evals workflow.
 */

import { z } from "zod";
import type { ResumeProfile } from "@/lib/resume/types";

export interface AgentEvalCase<Output> {
  /** Stable id — used in CI logs + telemetry. Don't rename. */
  id: string;
  name: string;
  /** One-line description of what this case is gating against. */
  description: string;
  /** The agent under test. Returns the actual output we'll assert on. */
  run: () => Promise<Output>;
  /** Zod schema the output must parse against (shape invariant). */
  shape: z.ZodType<Output>;
  /** Per-case assertions — each returns {ok, message?}. */
  assertions: Array<{
    name: string;
    check: (out: Output) => { ok: boolean; message?: string } | Promise<{ ok: boolean; message?: string }>;
  }>;
}

export interface EvalResult {
  id: string;
  name: string;
  passed: boolean;
  shapeOk: boolean;
  shapeError?: string;
  assertionResults: Array<{ name: string; ok: boolean; message?: string }>;
  durationMs: number;
}

export interface ProfileFixture {
  label: string;
  profile: ResumeProfile;
}
