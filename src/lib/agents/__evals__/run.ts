/**
 * Eval runner.
 *
 * Iterates EVAL_CASES, runs each agent, validates Zod shape + assertions,
 * prints a colorized pass/fail table, exits non-zero on failure.
 *
 * Local:  `npm run eval` (add to package.json scripts as: "eval": "tsx src/lib/agents/__evals__/run.ts")
 * CI:     nightly workflow — see .github/workflows/evals.yml
 *
 * Cost note: each case fires real LLM calls. Expect ~10-15¢ + ~30s per
 * full nightly run with the current fixture set.
 */

import { EVAL_CASES } from "./cases";
import type { EvalResult } from "./types";

async function runOne(caseDef: typeof EVAL_CASES[number]): Promise<EvalResult> {
  const start = Date.now();
  let output: unknown;
  let shapeOk = true;
  let shapeError: string | undefined;
  const assertionResults: EvalResult["assertionResults"] = [];

  try {
    output = await caseDef.run();
  } catch (err) {
    return {
      id: caseDef.id,
      name: caseDef.name,
      passed: false,
      shapeOk: false,
      shapeError: `Agent threw: ${err instanceof Error ? err.message : String(err)}`,
      assertionResults: [],
      durationMs: Date.now() - start,
    };
  }

  const parsed = caseDef.shape.safeParse(output);
  if (!parsed.success) {
    shapeOk = false;
    shapeError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }

  for (const a of caseDef.assertions) {
    try {
      const r = await a.check(output);
      assertionResults.push({ name: a.name, ok: r.ok, message: r.message });
    } catch (err) {
      assertionResults.push({
        name: a.name,
        ok: false,
        message: `assertion threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const passed = shapeOk && assertionResults.every((a) => a.ok);
  return { id: caseDef.id, name: caseDef.name, passed, shapeOk, shapeError, assertionResults, durationMs: Date.now() - start };
}

async function main(): Promise<void> {
  console.log(`\n=== Running ${EVAL_CASES.length} eval case(s) ===\n`);
  const results: EvalResult[] = [];
  for (const c of EVAL_CASES) {
    process.stdout.write(`  • ${c.id} … `);
    const r = await runOne(c);
    results.push(r);
    process.stdout.write(`${r.passed ? "PASS" : "FAIL"} (${r.durationMs}ms)\n`);
    if (!r.shapeOk) {
      console.log(`      shape error: ${r.shapeError}`);
    }
    for (const a of r.assertionResults) {
      if (!a.ok) console.log(`      ✗ ${a.name}: ${a.message ?? ""}`);
    }
  }
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n=== ${passed} passed, ${failed} failed (${results.length} total) ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Eval runner crashed:", err);
  process.exit(1);
});
