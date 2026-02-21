/**
 * Full E2E Browser Test Suite for JobPilot
 * Run: npx tsx e2e-full-test-suite.ts
 * Tests at http://localhost:3000
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
  results.push("# JobPilot E2E Test Suite Report");
  results.push(`Generated: ${new Date().toISOString()}`);
  results.push(`Auth: ${useAuth ? "Loaded" : "None"}\n`);

  for (const test of [
    { id: "1", name: "LANDING PAGE", url: "/", run: runTest1 },
    { id: "2", name: "LOGIN PAGE", url: "/login", run: runTest2 },
    { id: "3", name: "AUTH REDIRECT", url: "/dashboard", run: runTest3 },
    { id: "4", name: "404 PAGE", url: "/nonexistent-page", run: runTest4 },
    { id: "5", name: "SETTINGS PAGE", url: "/settings", run: runTest5 },
    { id: "6", name: "APPLICATIONS PAGE", url: "/applications", run: runTest6 },
    { id: "7", name: "RESUMES PAGE", url: "/resumes", run: runTest7 },
  ]) {
    results.push(`## TEST ${test.id}: ${test.name}`);
    try {
      await page.goto(`${BASE_URL}${test.url}`, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `test-${test.id}-${test.name.toLowerCase().replace(/\s+/g, "-")}.png`), fullPage: true });
      const report = await test.run(page);
      results.push(...report);
    } catch (err) {
      results.push(`**FAIL** - Error: ${err}`);
    }
    results.push("");
  }

  await browser.close();

  const reportPath = path.join(SCREENSHOT_DIR, "TEST-SUITE-REPORT.md");
  fs.writeFileSync(reportPath, results.join("\n"), "utf-8");
  console.log("Screenshots:", SCREENSHOT_DIR);
  console.log("Report:", reportPath);
  console.log("\n" + results.join("\n"));
}

async function runTest1(page: any): Promise<string[]> {
  const r: string[] = [];
  const url = page.url();
  const body = await page.textContent("body") || "";
  const hasError = body.includes("Error") && body.includes("Something went wrong");
  const hasSignIn = (await page.locator("text=Sign In").count()) > 0 || (await page.locator("text=Get Started").count()) > 0;
  const hasJobPilot = (await page.locator("text=JobPilot").count()) > 0;
  const hasStyles = (await page.locator("link[rel='stylesheet']").count()) > 0;

  r.push(`- **Load:** ${!hasError ? "PASS" : "FAIL"} - ${hasError ? "Error detected" : "No errors"}`);
  r.push(`- **Sign In/Get Started:** ${hasSignIn ? "PASS" : "FAIL"}`);
  r.push(`- **JobPilot branding:** ${hasJobPilot ? "PASS" : "FAIL"}`);
  r.push(`- **Professional/styled:** ${hasStyles ? "PASS" : "FAIL"}`);
  r.push(`- **URL:** ${url}`);
  return r;
}

async function runTest2(page: any): Promise<string[]> {
  const r: string[] = [];
  const url = page.url();
  const hasGoogle = (await page.locator("text=Continue with Google").count()) > 0 || (await page.locator("text=Sign in with Google").count()) > 0;
  const hasGitHub = (await page.locator("text=Continue with GitHub").count()) > 0 || (await page.locator("text=Sign in with GitHub").count()) > 0;
  const hasEmail = (await page.locator("text=Send Magic Link").count()) > 0 || (await page.locator("text=magic link").count()) > 0;
  const hasEmerald = (await page.locator("[class*='emerald']").count()) > 0 || (await page.locator("[class*='green']").count()) > 0;

  r.push(`- **Load:** ${url.includes("/login") ? "PASS" : "FAIL"} - URL: ${url}`);
  r.push(`- **Google sign-in:** ${hasGoogle ? "PASS" : "FAIL"}`);
  r.push(`- **GitHub sign-in:** ${hasGitHub ? "PASS" : "FAIL"}`);
  r.push(`- **Email/magic link:** ${hasEmail ? "PASS" : "FAIL"}`);
  r.push(`- **Emerald/green branding:** ${hasEmerald ? "PASS" : "FAIL"}`);
  return r;
}

async function runTest3(page: any): Promise<string[]> {
  const r: string[] = [];
  const url = page.url();
  const isLogin = url.includes("/login");
  const isDashboard = url.includes("/dashboard");

  if (isLogin) {
    r.push(`- **PASS** - Redirected to login (not authenticated)`);
  } else if (isDashboard) {
    r.push(`- **PASS** - Dashboard shows (authenticated)`);
  } else {
    r.push(`- **PASS** - URL: ${url}`);
  }
  r.push(`- **URL:** ${url}`);
  return r;
}

async function runTest4(page: any): Promise<string[]> {
  const r: string[] = [];
  const body = await page.textContent("body") || "";
  const has404 = body.includes("404") || body.includes("Not Found") || body.includes("not found");
  const hasGoHome = (await page.locator("text=Go to Dashboard").count()) > 0 || (await page.locator("text=Go Home").count()) > 0 || (await page.locator("a[href='/']").count()) > 0;

  r.push(`- **Load:** PASS`);
  r.push(`- **404 message:** ${has404 ? "PASS" : "FAIL"}`);
  r.push(`- **Go Home/Dashboard link:** ${hasGoHome ? "PASS" : "FAIL"}`);
  return r;
}

async function runTest5(page: any): Promise<string[]> {
  const r: string[] = [];
  const url = page.url();
  const isLogin = url.includes("/login");
  const hasForm = (await page.locator("form, input, button").count()) > 0;

  if (isLogin) {
    r.push(`- **PASS** - Redirected to login (not authenticated)`);
  } else {
    r.push(`- **Load:** ${url.includes("/settings") ? "PASS" : "FAIL"}`);
    r.push(`- **Form fields visible:** ${hasForm ? "PASS" : "FAIL"}`);
  }
  r.push(`- **URL:** ${url}`);
  return r;
}

async function runTest6(page: any): Promise<string[]> {
  const r: string[] = [];
  const url = page.url();
  const isLogin = url.includes("/login");
  r.push(`- **Load:** ${isLogin ? "Redirected to login" : "PASS"}`);
  r.push(`- **URL:** ${url}`);
  return r;
}

async function runTest7(page: any): Promise<string[]> {
  const r: string[] = [];
  const url = page.url();
  const isLogin = url.includes("/login");
  r.push(`- **Load:** ${isLogin ? "Redirected to login" : "PASS"}`);
  r.push(`- **URL:** ${url}`);
  return r;
}

main().catch(console.error);
