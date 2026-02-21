import "./test-utils";
import { execSync } from "child_process";
import { header, verdict, GREEN, RED, YELLOW, RESET, BOLD, DIM, getUserId } from "./test-utils";

const userId = getUserId();

interface ScriptResult {
  name: string;
  label: string;
  exitCode: number;
  duration: number;
  output: string;
}

const SCRIPTS: Array<{ name: string; label: string; args?: string }> = [
  { name: "test-auth-flow", label: "Auth & User" },
  { name: "test-settings-crud", label: "Settings CRUD" },
  { name: "test-resume-pipeline", label: "Resume Pipeline" },
  { name: "test-matching-engine", label: "Matching Engine" },
  { name: "test-email-generation", label: "Email Generation" },
  { name: "test-email-sending", label: "Email Sending" },
  { name: "test-application-flow", label: "Application Lifecycle" },
  { name: "test-cron-instant-apply", label: "Cron: Match Users", args: "--dry-run" },
  { name: "test-cron-send-scheduled", label: "Cron: Send Scheduled", args: "--dry-run" },
  { name: "test-kanban-data", label: "Kanban Data" },
  { name: "test-full-pipeline", label: "Full Pipeline" },
  { name: "test-edge-cases", label: "Edge Cases" },
];

async function main() {
  const startAll = Date.now();
  const results: ScriptResult[] = [];

  header("JOBPILOT — COMPLETE TEST SUITE");
  console.log(`  User: ${userId}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Scripts: ${SCRIPTS.length}`);
  console.log("");

  for (let i = 0; i < SCRIPTS.length; i++) {
    const s = SCRIPTS[i];
    const num = String(i + 1).padStart(2, " ");
    const label = s.label.padEnd(24);
    process.stdout.write(`  ${DIM}[${num}/${SCRIPTS.length}]${RESET} ${label} `);

    const needsUserId = !["test-cron-instant-apply", "test-cron-send-scheduled"].includes(s.name);
    const args = [needsUserId ? userId : "", s.args || ""].filter(Boolean).join(" ");
    const cmd = `npx tsx src/scripts/${s.name}.ts ${args}`;

    const start = Date.now();
    let exitCode = 0;
    let output = "";

    try {
      output = execSync(cmd, {
        encoding: "utf-8",
        timeout: 300_000,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });
      exitCode = 0;
    } catch (err: any) {
      exitCode = err.status ?? 1;
      output = (err.stdout || "") + "\n" + (err.stderr || "");
    }

    const duration = Date.now() - start;
    const durStr = `${(duration / 1000).toFixed(1)}s`;

    const hasError = /^\s*❌/m.test(output) || exitCode !== 0;
    const hasWarn = /^\s*⚠️/m.test(output);

    let status: string;
    if (exitCode !== 0) {
      status = `${RED}CRASH${RESET}`;
    } else if (hasError) {
      status = `${RED}FAIL${RESET} `;
    } else if (hasWarn) {
      status = `${YELLOW}WARN${RESET} `;
    } else {
      status = `${GREEN}PASS${RESET} `;
    }

    console.log(`${status} ${DIM}(${durStr})${RESET}`);

    results.push({ name: s.name, label: s.label, exitCode, duration, output });
  }

  const totalDuration = ((Date.now() - startAll) / 1000).toFixed(1);

  verdict("JOBPILOT — COMBINED REPORT");
  console.log(`  Duration: ${totalDuration}s`);
  console.log("");
  console.log(`  ${"#".padStart(2)} │ ${"Test".padEnd(24)} │ Status │ Time`);
  console.log(`  ${"──"}┼${"─".repeat(26)}┼${"─".repeat(8)}┼${"─".repeat(8)}`);

  let passes = 0, warns = 0, fails = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const num = String(i + 1).padStart(2);
    const label = r.label.padEnd(24);
    const durStr = `${(r.duration / 1000).toFixed(1)}s`.padEnd(6);

    const hasErr = /^\s*❌/m.test(r.output) || r.exitCode !== 0;
    const hasWrn = /^\s*⚠️/m.test(r.output);

    let icon: string;
    if (r.exitCode !== 0) {
      icon = `${RED}💥${RESET}`;
      fails++;
    } else if (hasErr) {
      icon = `${RED}❌${RESET}`;
      fails++;
    } else if (hasWrn) {
      icon = `${YELLOW}⚠️${RESET} `;
      warns++;
    } else {
      icon = `${GREEN}✅${RESET}`;
      passes++;
    }

    console.log(`  ${num} │ ${label} │  ${icon}  │ ${durStr}`);
  }

  console.log("");
  console.log(`  ${BOLD}TOTAL:${RESET} ${GREEN}${passes} ✅${RESET}  ${YELLOW}${warns} ⚠️${RESET}  ${RED}${fails} ❌${RESET}`);
  console.log("");

  // Show issues from failed/warned scripts
  const problemScripts = results.filter(
    (r) => r.exitCode !== 0 || /^\s*❌/m.test(r.output) || /^\s*⚠️/m.test(r.output)
  );

  if (problemScripts.length > 0) {
    console.log(`  ${BOLD}ISSUES DETECTED:${RESET}`);
    for (const r of problemScripts) {
      console.log(`\n  ${BOLD}[${r.label}]${RESET}`);
      if (r.exitCode !== 0) {
        console.log(`    ${RED}Script crashed (exit code ${r.exitCode})${RESET}`);
        const lastLines = r.output.split("\n").filter(Boolean).slice(-5);
        for (const line of lastLines) {
          console.log(`    ${DIM}${line.trim()}${RESET}`);
        }
      } else {
        const issueLines = r.output
          .split("\n")
          .filter((l) => /^\s*❌/.test(l) || /^\s*⚠️/.test(l))
          .slice(0, 5);
        for (const line of issueLines) {
          console.log(`    ${line.trim()}`);
        }
      }
    }
    console.log("");
  }

  const overall = fails > 0 ? `${RED}ISSUES FOUND${RESET}` : warns > 0 ? `${YELLOW}MOSTLY WORKING${RESET}` : `${GREEN}ALL SYSTEMS GO${RESET}`;
  console.log(`  ${BOLD}OVERALL:${RESET} ${overall}`);
  console.log("");

  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Master runner failed:", e);
  process.exit(1);
});
