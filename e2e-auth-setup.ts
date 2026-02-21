/**
 * Auth setup for E2E tests - saves session after manual login
 * Run: npx tsx e2e-auth-setup.ts
 * 1. Opens browser in headed mode
 * 2. Navigates to login - YOU log in manually (magic link, Google, or GitHub)
 * 3. After redirect to dashboard, saves storage state to .auth/user.json
 * 4. e2e-browser-test.ts can then use this for authenticated tests
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3002";
const AUTH_DIR = path.join(process.cwd(), ".auth");

async function main() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log("Navigating to login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  console.log("\n>>> LOG IN MANUALLY (magic link, Google, or GitHub) <<<");
  console.log(
    ">>> Wait until you're on the dashboard, then press Enter here <<<\n",
  );

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const url = page.url();
  if (url.includes("/login")) {
    console.log("Still on login page - session not saved.");
  } else {
    await context.storageState({ path: path.join(AUTH_DIR, "user.json") });
    console.log("Session saved to .auth/user.json");
  }
  await browser.close();
}

main().catch(console.error);
