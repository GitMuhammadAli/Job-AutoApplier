/**
 * E2E Auth Flow & Page Tests for JobPilot
 * Run: npx tsx e2e-auth-flow-test.ts
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");
const AUTH_FILE = path.join(process.cwd(), ".auth", "user.json");

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const useAuth = fs.existsSync(AUTH_FILE);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    ...(useAuth ? { storageState: AUTH_FILE } : {}),
  });
  const page = await context.newPage();

  const results: string[] = [];
  results.push("# JobPilot Auth Flow & Page Tests");
  results.push(`Generated: ${new Date().toISOString()}`);
  results.push(`Auth state: ${useAuth ? "Loaded" : "None"}\n`);

  // TEST 1: Login page + try email sign-in
  results.push("## TEST 1: Login Page");
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-1-login.png"), fullPage: true });

    const hasGoogle = (await page.locator("text=Continue with Google").count()) > 0;
    const hasGitHub = (await page.locator("text=Continue with GitHub").count()) > 0;
    const hasEmail = (await page.locator("text=Send Magic Link").count()) > 0;
    results.push(`- Google sign-in: ${hasGoogle ? "Yes" : "No"}`);
    results.push(`- GitHub sign-in: ${hasGitHub ? "Yes" : "No"}`);
    results.push(`- Email magic link: ${hasEmail ? "Yes" : "No"}`);

    if (hasEmail) {
      await page.fill('#login-email', "test@test.com");
      await page.getByRole('button', { name: /Send Magic Link/i }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-1-after-email.png"), fullPage: true });
      const body = await page.textContent("body") || "";
      const emailSent = body.includes("Check your inbox") || body.includes("sent") || body.includes("inbox");
      results.push(`- Email submitted: Yes`);
      results.push(`- Confirmation shown: ${emailSent ? "Yes" : "No"}`);
    }
  } catch (e) {
    results.push(`- Error: ${e}`);
  }
  results.push("");

  // TEST 2: Dashboard
  results.push("## TEST 2: Dashboard");
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-2-dashboard.png"), fullPage: true });
    const url = page.url();
    if (url.includes("/login")) {
      results.push("- Redirected to login (no session) - expected");
    } else {
      const hasKanban = (await page.locator("text=Job Pipeline").count()) > 0;
      const hasColumns = (await page.locator("text=Saved").count()) > 0 || (await page.locator("text=Applied").count()) > 0;
      const hasCards = (await page.locator('[class*="rounded-xl"]').count()) > 0;
      results.push("- Dashboard loaded");
      results.push(`- Kanban visible: ${hasKanban ? "Yes" : "No"}`);
      results.push(`- Columns (Saved/Applied): ${hasColumns ? "Yes" : "No"}`);
      results.push(`- Job cards: ${hasCards ? "Yes" : "No"}`);
    }
    results.push(`- URL: ${url}`);
  } catch (e) {
    results.push(`- Error: ${e}`);
  }
  results.push("");

  // TEST 3: Settings
  results.push("## TEST 3: Settings");
  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-3-settings.png"), fullPage: true });
    const url = page.url();
    if (url.includes("/login")) {
      results.push("- Redirected to login (auth protection works)");
    } else {
      const hasForm = (await page.locator("form, input").count()) > 0;
      const hasSave = (await page.locator("button:has-text('Save')").count()) > 0;
      results.push("- Settings loaded");
      results.push(`- Form fields: ${hasForm ? "Yes" : "No"}`);
      results.push(`- Save button: ${hasSave ? "Yes" : "No"}`);
    }
    results.push(`- URL: ${url}`);
  } catch (e) {
    results.push(`- Error: ${e}`);
  }
  results.push("");

  // TEST 4: Applications
  results.push("## TEST 4: Applications");
  try {
    await page.goto(`${BASE_URL}/applications`, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-4-applications.png"), fullPage: true });
    const url = page.url();
    if (url.includes("/login")) {
      results.push("- Redirected to login");
    } else {
      const hasQueue = (await page.locator("text=application").count()) > 0 || (await page.locator("text=Draft").count()) > 0;
      results.push(`- Application queue visible: ${hasQueue ? "Yes" : "Unknown"}`);
    }
    results.push(`- URL: ${url}`);
  } catch (e) {
    results.push(`- Error: ${e}`);
  }
  results.push("");

  // TEST 5: Analytics
  results.push("## TEST 5: Analytics");
  try {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-5-analytics.png"), fullPage: true });
    const url = page.url();
    if (url.includes("/login")) {
      results.push("- Redirected to login");
    } else {
      results.push("- Analytics page loaded");
    }
    results.push(`- URL: ${url}`);
  } catch (e) {
    results.push(`- Error: ${e}`);
  }
  results.push("");

  // TEST 6: Templates
  results.push("## TEST 6: Templates");
  try {
    await page.goto(`${BASE_URL}/templates`, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "auth-6-templates.png"), fullPage: true });
    const url = page.url();
    if (url.includes("/login")) {
      results.push("- Redirected to login");
    } else {
      results.push("- Templates page loaded");
    }
    results.push(`- URL: ${url}`);
  } catch (e) {
    results.push(`- Error: ${e}`);
  }

  await browser.close();

  const reportPath = path.join(SCREENSHOT_DIR, "AUTH-FLOW-REPORT.md");
  fs.writeFileSync(reportPath, results.join("\n"), "utf-8");
  console.log("Screenshots:", SCREENSHOT_DIR);
  console.log("\n" + results.join("\n"));
}

main().catch(console.error);
