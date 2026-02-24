/**
 * JobPilot User Test Plan - E2E Browser Test
 * Run: npx tsx e2e-user-test-plan.ts
 * Tests the app at http://localhost:3000 as a real user would.
 * Screenshots saved to ./test-screenshots/
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");
const AUTH_FILE = path.join(process.cwd(), ".auth", "user.json");

interface TestResult {
  test: string;
  pass: boolean;
  details: string;
  issues?: string[];
}

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome", // Use system Chrome (avoids EBUSY with Playwright bundled browser)
  });
  const contextOptions: { viewport: { width: number; height: number }; ignoreHTTPSErrors: boolean; storageState?: string } = {
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  };
  if (fs.existsSync(AUTH_FILE)) {
    contextOptions.storageState = AUTH_FILE;
    console.log("Using saved auth from .auth/user.json");
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const results: TestResult[] = [];

  try {
    // ========== TEST 1: Login Page ==========
    console.log("TEST 1: Login Page...");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-login-or-landing.png"),
      fullPage: true,
    });
    const url1 = page.url();
    const bodyText1 = (await page.textContent("body")) || "";
    const isLogin = url1.includes("/login");
    const isLanding = bodyText1.includes("JobPilot") || bodyText1.includes("Sign in") || bodyText1.includes("Get Started");
    const pass1 = isLogin || isLanding;
    results.push({
      test: "TEST 1: Login Page",
      pass: pass1,
      details: `Loaded ${url1}. ${isLogin ? "Redirected to login page." : isLanding ? "Landing page visible." : "Page loaded."}`,
      issues: pass1 ? undefined : ["App did not load correctly - unexpected page content"],
    });

    // ========== TEST 2: Dashboard ==========
    console.log("TEST 2: Dashboard...");
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-dashboard.png"),
      fullPage: true,
    });
    const url2 = page.url();
    const bodyText2 = (await page.textContent("body")) || "";
    const redirectedToLogin = url2.includes("/login");
    const hasFeedbackButton = bodyText2.includes("Feedback") || (await page.locator('button[aria-label="Send feedback"]').count() > 0);
    const hasDashboardContent = bodyText2.includes("Job Pipeline") || bodyText2.includes("Dashboard") || bodyText2.includes("Applications");
    const pass2 = !redirectedToLogin && (hasDashboardContent || hasFeedbackButton);
    results.push({
      test: "TEST 2: Dashboard",
      pass: pass2,
      details: redirectedToLogin
        ? "Redirected to login (auth required)"
        : `Dashboard loaded. Feedback button: ${hasFeedbackButton ? "Yes" : "No"}. Content: ${hasDashboardContent ? "Yes" : "No"}`,
      issues: !hasFeedbackButton && !redirectedToLogin ? ["Feedback floating button not found"] : undefined,
    });

    // ========== TEST 3: Recommended Page ==========
    console.log("TEST 3: Recommended Page...");
    await page.goto(`${BASE_URL}/recommended`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-recommended.png"),
      fullPage: true,
    });
    const url3 = page.url();
    const bodyText3 = (await page.textContent("body")) || "";
    const redirectedToLogin3 = url3.includes("/login");
    const hasSearchBar = (await page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').count()) > 0;
    const hasFilters = bodyText3.includes("source") || bodyText3.includes("score") || bodyText3.includes("location") || bodyText3.includes("Source") || bodyText3.includes("Score") || bodyText3.includes("Location");
    const hasJobCards = (await page.locator('[class*="rounded-xl"], [class*="card"], article').count()) > 0 || bodyText3.includes("Recommended");
    const pass3 = !redirectedToLogin3 && (hasSearchBar || hasFilters || hasJobCards);
    results.push({
      test: "TEST 3: Recommended Page",
      pass: pass3,
      details: redirectedToLogin3
        ? "Redirected to login (auth required)"
        : `Search bar: ${hasSearchBar ? "Yes" : "No"}. Filters (source, score, location): ${hasFilters ? "Yes" : "No"}. Job cards: ${hasJobCards ? "Yes" : "No"}`,
      issues:
        !redirectedToLogin3 && (!hasFilters || !hasSearchBar)
          ? [(!hasFilters ? "Filters not visible by default " : "") + (!hasSearchBar ? "Search bar not found" : "")].filter(Boolean)
          : undefined,
    });

    // ========== TEST 4: Applications Page ==========
    console.log("TEST 4: Applications Page...");
    await page.goto(`${BASE_URL}/applications`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-applications.png"),
      fullPage: true,
    });
    const url4 = page.url();
    const bodyText4 = (await page.textContent("body")) || "";
    const redirectedToLogin4 = url4.includes("/login");
    const hasTabs = bodyText4.includes("Draft") || bodyText4.includes("Ready") || bodyText4.includes("Sent") || bodyText4.includes("Drafts") || bodyText4.includes("Ready to Send");
    const pass4 = !redirectedToLogin4 && (hasTabs || bodyText4.includes("Applications"));
    results.push({
      test: "TEST 4: Applications Page",
      pass: pass4,
      details: redirectedToLogin4
        ? "Redirected to login (auth required)"
        : `Tabs (Drafts, Ready to Send, etc.): ${hasTabs ? "Yes" : "No"}`,
      issues: !redirectedToLogin4 && !hasTabs ? ["Tabs not visible"] : undefined,
    });

    // ========== TEST 5: Settings Page ==========
    console.log("TEST 5: Settings Page...");
    await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-settings.png"),
      fullPage: true,
    });
    const url5 = page.url();
    const bodyText5 = (await page.textContent("body")) || "";
    const redirectedToLogin5 = url5.includes("/login");
    const hasProfileTab = bodyText5.includes("Profile");
    const hasJobPrefTab = bodyText5.includes("Job Preferences") || bodyText5.includes("Preferences");
    const hasEmailTab = bodyText5.includes("Email");
    const hasAutomationTab = bodyText5.includes("Automation");
    const hasAITab = bodyText5.includes("AI");
    const hasAccountTab = bodyText5.includes("Account");
    const tabCount = [hasProfileTab, hasJobPrefTab, hasEmailTab, hasAutomationTab, hasAITab, hasAccountTab].filter(Boolean).length;
    const pass5 = !redirectedToLogin5 && tabCount >= 4;
    results.push({
      test: "TEST 5: Settings Page",
      pass: pass5,
      details: redirectedToLogin5
        ? "Redirected to login (auth required)"
        : `Tabbed layout: Profile=${hasProfileTab}, Job Prefs=${hasJobPrefTab}, Email=${hasEmailTab}, Automation=${hasAutomationTab}, AI=${hasAITab}, Account=${hasAccountTab} (${tabCount}/6 tabs)`,
      issues: !redirectedToLogin5 && tabCount < 4 ? ["Not all expected tabs visible"] : undefined,
    });

    // ========== TEST 6: Feedback Widget ==========
    console.log("TEST 6: Feedback Widget...");
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    const feedbackBtn = page.locator('button:has-text("Feedback"), button[aria-label="Send feedback"]').first();
    const hasFeedbackBtn = (await feedbackBtn.count()) > 0;
    let feedbackModalOpen = false;
    let has4TypeButtons = false;
    let formWorks = false;
    if (hasFeedbackBtn && !page.url().includes("/login")) {
      await feedbackBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-feedback-modal.png"),
        fullPage: false,
      });
      const modalText = (await page.textContent("body")) || "";
      feedbackModalOpen = modalText.includes("Send Feedback") || modalText.includes("Bug Report");
      has4TypeButtons =
        modalText.includes("Bug Report") &&
        modalText.includes("Suggestion") &&
        modalText.includes("Compliment") &&
        modalText.includes("Other");
      await page.fill('textarea[placeholder*="What"], textarea[placeholder*="Tell"], textarea', "Test feedback message from browser test");
      formWorks = (await page.locator('textarea').inputValue()) === "Test feedback message from browser test";
    }
    const pass6 = !page.url().includes("/login") && hasFeedbackBtn && feedbackModalOpen && has4TypeButtons && formWorks;
    results.push({
      test: "TEST 6: Feedback Widget",
      pass: pass6,
      details:
        page.url().includes("/login")
          ? "Skipped - not authenticated"
          : `Button: ${hasFeedbackBtn ? "Yes" : "No"}. Modal opens: ${feedbackModalOpen ? "Yes" : "No"}. 4 type buttons: ${has4TypeButtons ? "Yes" : "No"}. Form accepts input: ${formWorks ? "Yes" : "No"}`,
      issues:
        !page.url().includes("/login") && !pass6
          ? [
              !hasFeedbackBtn && "Feedback button not found",
              hasFeedbackBtn && !feedbackModalOpen && "Modal did not open",
              feedbackModalOpen && !has4TypeButtons && "4 type buttons (Bug, Suggestion, Compliment, Other) not all visible",
              !formWorks && "Form did not accept test message",
            ].filter(Boolean) as string[]
          : undefined,
    });

    // ========== TEST 7: Admin Panel ==========
    console.log("TEST 7: Admin Panel...");
    await page.goto(`${BASE_URL}/admin`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-admin.png"),
      fullPage: true,
    });
    const url7 = page.url();
    const bodyText7 = (await page.textContent("body")) || "";
    const redirectedToAdminLogin = url7.includes("/admin/login");
    const hasFeedbackLink = bodyText7.includes("Feedback") && (bodyText7.includes("Admin") || bodyText7.includes("Dashboard"));
    const pass7 = !redirectedToAdminLogin && hasFeedbackLink;
    results.push({
      test: "TEST 7: Admin Panel",
      pass: pass7,
      details: redirectedToAdminLogin
        ? "Redirected to admin login (admin auth required)"
        : `Feedback link in sidebar: ${hasFeedbackLink ? "Yes" : "No"}`,
      issues: !redirectedToAdminLogin && !hasFeedbackLink ? ["Feedback link not found in admin sidebar"] : undefined,
    });

    // ========== TEST 8: Admin Feedback Page ==========
    console.log("TEST 8: Admin Feedback Page...");
    await page.goto(`${BASE_URL}/admin/feedback`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08-admin-feedback.png"),
      fullPage: true,
    });
    const url8 = page.url();
    const bodyText8 = (await page.textContent("body")) || "";
    const redirectedToAdminLogin8 = url8.includes("/admin/login");
    const hasFilters8 = bodyText8.includes("All") || bodyText8.includes("new") || bodyText8.includes("resolved");
    const hasEmptyState = bodyText8.includes("No feedback") || bodyText8.includes("User Feedback") || bodyText8.includes("total");
    const pass8 = !redirectedToAdminLogin8 && (hasFilters8 || hasEmptyState);
    results.push({
      test: "TEST 8: Admin Feedback Page",
      pass: pass8,
      details: redirectedToAdminLogin8
        ? "Redirected to admin login (admin auth required)"
        : `Filters: ${hasFilters8 ? "Yes" : "No"}. Empty state or list: ${hasEmptyState ? "Yes" : "No"}`,
      issues: !redirectedToAdminLogin8 && !hasFilters8 && !hasEmptyState ? ["Filters and empty state not visible"] : undefined,
    });
  } catch (err) {
    console.error("Test error:", err);
    results.push({
      test: "Test Execution",
      pass: false,
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
      issues: ["Test script encountered an error"],
    });
  } finally {
    await browser.close();
  }

  // ========== Generate Report ==========
  const report: string[] = [];
  report.push("# JobPilot User Test Plan - Detailed Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Base URL: ${BASE_URL}`);
  report.push("");
  report.push("## Summary");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  report.push(`- **PASS:** ${passed}/${results.length}`);
  report.push(`- **FAIL:** ${failed}/${results.length}`);
  report.push("");
  report.push("## Screenshots");
  report.push("Screenshots saved to `./test-screenshots/`:");
  for (let i = 1; i <= 8; i++) {
    report.push(`- \`0${i}-*.png\` - Test ${i}`);
  }
  report.push("");
  report.push("## Detailed Results");
  for (const r of results) {
    report.push(`### ${r.test}`);
    report.push(`- **Status:** ${r.pass ? "PASS" : "FAIL"}`);
    report.push(`- **Details:** ${r.details}`);
    if (r.issues && r.issues.length > 0) {
      report.push(`- **Issues:**`);
      for (const issue of r.issues) {
        report.push(`  - ${issue}`);
      }
    }
    report.push("");
  }

  const reportPath = path.join(process.cwd(), "test-report.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("\n" + report.join("\n"));
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch(console.error);
