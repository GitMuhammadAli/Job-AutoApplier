import * as fs from "fs";
import * as path from "path";

// Load .env manually for scripts
try {
  const envPath = path.resolve(process.cwd(), ".env");
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const CYAN = "\x1b[36m";
export const DIM = "\x1b[2m";
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const MAGENTA = "\x1b[35m";

export const pass = (msg: string) => console.log(`  ${GREEN}✅${RESET} ${msg}`);
export const fail = (msg: string) => console.log(`  ${RED}❌${RESET} ${msg}`);
export const warn = (msg: string) => console.log(`  ${YELLOW}⚠️${RESET}  ${msg}`);
export const info = (msg: string) => console.log(`  ${CYAN}ℹ${RESET}  ${msg}`);

export const header = (title: string) => {
  console.log("");
  console.log("═".repeat(60));
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log("═".repeat(60));
};

export const subheader = (title: string) => {
  console.log(`\n  ${BOLD}${title}${RESET}`);
  console.log(`  ${"─".repeat(50)}`);
};

export const verdict = (title: string) => {
  console.log("");
  console.log("═".repeat(60));
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log("═".repeat(60));
};

export const timer = () => {
  const start = Date.now();
  return () => Date.now() - start;
};

export const safely = async <T>(fn: () => Promise<T>, label: string): Promise<T | null> => {
  try {
    return await fn();
  } catch (error: any) {
    fail(`${label}: ${error.message}`);
    return null;
  }
};

export const getUserId = () => {
  const userId = process.argv[2];
  if (!userId) {
    console.error(`${RED}Usage: npx tsx src/scripts/<script>.ts <userId>${RESET}`);
    process.exit(1);
  }
  return userId;
};

export interface TestResult {
  name: string;
  status: "pass" | "warn" | "fail";
  issues: string[];
  duration: number;
}

export function summarize(results: TestResult[]) {
  const passes = results.filter((r) => r.status === "pass").length;
  const warns = results.filter((r) => r.status === "warn").length;
  const fails = results.filter((r) => r.status === "fail").length;

  console.log("");
  console.log(`  ${GREEN}${passes} ✅${RESET}  ${YELLOW}${warns} ⚠️${RESET}  ${RED}${fails} ❌${RESET}`);

  const allIssues = results.flatMap((r) => r.issues.map((i) => `[${r.name}] ${i}`));
  if (allIssues.length > 0) {
    console.log("");
    console.log(`  ${BOLD}Issues:${RESET}`);
    for (const issue of allIssues) {
      console.log(`    • ${issue}`);
    }
  }
  console.log("");
}

export function mask(value: string | null | undefined, showChars = 4): string {
  if (!value) return "(not set)";
  if (value.length <= showChars) return "****";
  return value.slice(0, showChars) + "****" + value.slice(-showChars);
}
