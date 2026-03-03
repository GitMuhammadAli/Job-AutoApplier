let _suite = "";
let _passed = 0;
let _failed = 0;
const _results: Array<{ name: string; status: "PASS" | "FAIL"; error?: string }> = [];

export function suite(name: string) {
  _suite = name;
  _passed = 0;
  _failed = 0;
  _results.length = 0;
}

export async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    _passed++;
    _results.push({ name, status: "PASS" });
    console.log(`  ✅ PASS — ${name}`);
  } catch (e: unknown) {
    _failed++;
    const msg = e instanceof Error ? e.message : String(e);
    _results.push({ name, status: "FAIL", error: msg });
    console.log(`  ❌ FAIL — ${name}`);
    console.log(`           ${msg}`);
  }
}

export function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export function eq<T>(actual: T, expected: T, label = "") {
  if (actual !== expected) {
    throw new Error(`${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function neq<T>(actual: T, notExpected: T, label = "") {
  if (actual === notExpected) {
    throw new Error(`${label ? label + ": " : ""}expected NOT ${JSON.stringify(notExpected)}`);
  }
}

export function deepEq<T>(actual: T, expected: T, label = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${label ? label + ": " : ""}expected ${b}, got ${a}`);
  }
}

export async function throws(fn: () => void | Promise<void>, label = "") {
  try {
    await fn();
    throw new Error(`${label ? label + ": " : ""}expected function to throw`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("expected function to throw")) throw e;
  }
}

export function gte(actual: number, min: number, label = "") {
  if (actual < min) {
    throw new Error(`${label ? label + ": " : ""}expected >= ${min}, got ${actual}`);
  }
}

export function lt(actual: number, max: number, label = "") {
  if (actual >= max) {
    throw new Error(`${label ? label + ": " : ""}expected < ${max}, got ${actual}`);
  }
}

export function includes(str: string, sub: string, label = "") {
  if (!str.includes(sub)) {
    throw new Error(`${label ? label + ": " : ""}expected "${str}" to include "${sub}"`);
  }
}

export function summary(): { suite: string; passed: number; failed: number; results: typeof _results } {
  console.log(`\n  ${_suite}: ${_passed} passed, ${_failed} failed\n`);
  return { suite: _suite, passed: _passed, failed: _failed, results: [..._results] };
}
