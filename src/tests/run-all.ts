import { execSync } from "child_process";
import { readdirSync } from "fs";
import { join } from "path";

const testDir = join(__dirname);
const testFiles = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort();

interface SectionResult {
  file: string;
  passed: number;
  failed: number;
  output: string;
  exitCode: number;
}

const results: SectionResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

console.log("═══════════════════════════════════════════");
console.log("JOBPILOT COMPLETE TEST REPORT");
console.log("═══════════════════════════════════════════\n");

for (const file of testFiles) {
  const filePath = join(testDir, file);
  let output = "";
  let exitCode = 0;

  try {
    output = execSync(`npx tsx "${filePath}"`, {
      encoding: "utf-8",
      timeout: 30000,
      cwd: join(__dirname, "../.."),
      env: { ...process.env, ENCRYPTION_KEY: "test-key-for-unit-tests-32chars!!" },
    });
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    output = (execErr.stdout || "") + (execErr.stderr || "");
    exitCode = execErr.status || 1;
  }

  // Parse pass/fail from output
  const passMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);
  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : (exitCode !== 0 ? 1 : 0);

  totalPassed += passed;
  totalFailed += failed;

  results.push({ file, passed, failed, output, exitCode });

  const status = failed > 0 ? "❌" : "✅";
  const sectionName = file.replace(".test.ts", "").replace("section", "Section ");
  console.log(`${status} ${sectionName}: ${passed} passed, ${failed} failed`);
}

console.log("\n═══════════════════════════════════════════");
console.log("SUMMARY");
console.log(`  Total:   ${totalPassed + totalFailed} tests`);
console.log(`  Passed:  ${totalPassed}`);
console.log(`  Failed:  ${totalFailed}`);
console.log("═══════════════════════════════════════════\n");

if (totalFailed > 0) {
  console.log("FAILED TESTS:\n");
  for (const r of results) {
    if (r.failed > 0) {
      const failLines = r.output.split("\n").filter((l) => l.includes("FAIL") || l.includes("expected") || l.includes("Assertion"));
      console.log(`  ${r.file}:`);
      for (const line of failLines) {
        console.log(`    ${line.trim()}`);
      }
      console.log();
    }
  }
}

process.exit(totalFailed > 0 ? 1 : 0);
