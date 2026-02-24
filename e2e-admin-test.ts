/**
 * JobPilot Admin Panel E2E Test
 * Run: npx tsx e2e-admin-test.ts
 * Logs in with admin/admin123 and tests all admin pages.
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots", "admin");
// Use ADMIN_TEST_USER / ADMIN_TEST_PASS env vars to override (e.g. match your .env)
const ADMIN_USER = process.env.ADMIN_TEST_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_TEST_PASS || "admin123";

interface StepResult {
  step: string;
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
    channel: "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const results: StepResult[] = [];

  try {
    // ========== STEP 1: Admin Login ==========
    console.log("STEP 1: Admin Login...");
    await page.goto(`${BASE_URL}/admin/login`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    const usernameField = page.locator('#admin-user');
    const passwordField = page.locator('#admin-pass');
    const signInBtn = page.getByRole("button", { name: /Sign in to Admin/i });

    // Fill username (user said it should already say "admin" - placeholder is "admin", field may be empty)
    await usernameField.fill(ADMIN_USER);
    await passwordField.fill(ADMIN_PASS);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-before-login.png"),
      fullPage: true,
    });
    await signInBtn.click();
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 10000 }).catch(() => {});

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-after-login.png"),
      fullPage: true,
    });

    const urlAfterLogin = page.url();
    const loginSuccess = !urlAfterLogin.includes("/admin/login");
    const bodyAfter = (await page.textContent("body")) || "";
    const hasError = bodyAfter.includes("Invalid credentials") || bodyAfter.includes("Login failed");

    results.push({
      step: "STEP 1: Admin Login",
      pass: loginSuccess && !hasError,
      details: loginSuccess
        ? `Logged in successfully. Redirected to ${urlAfterLogin}`
        : hasError
          ? "Login failed: Invalid credentials (admin/admin123 may not match env ADMIN_USERNAME/ADMIN_PASSWORD)"
          : `Still on login page. URL: ${urlAfterLogin}`,
      issues: !loginSuccess ? ["Check .env: ADMIN_USERNAME and ADMIN_PASSWORD must match admin/admin123"] : undefined,
    });

    if (!loginSuccess) {
      results.push(
        { step: "STEP 2: Admin Dashboard", pass: false, details: "Skipped - login failed" },
        { step: "STEP 3: Admin Feedback Page", pass: false, details: "Skipped - login failed" },
        { step: "STEP 4: Admin Scrapers Page", pass: false, details: "Skipped - login failed" },
        { step: "STEP 5: Admin Users Page", pass: false, details: "Skipped - login failed" },
        { step: "STEP 6: Admin Logs Page", pass: false, details: "Skipped - login failed" }
      );
    } else {
      // ========== STEP 2: Admin Dashboard ==========
      console.log("STEP 2: Admin Dashboard...");
      if (!page.url().includes("/admin") || page.url().includes("/admin/login")) {
        await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle", timeout: 15000 });
      }
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-dashboard.png"),
        fullPage: true,
      });
      const dashBody = (await page.textContent("body")) || "";
      const hasStatCards = dashBody.includes("Users") || dashBody.includes("Active Jobs") || dashBody.includes("Drafts");
      const hasScraperHealth = dashBody.includes("Scraper Health") || dashBody.includes("scrapers");
      const hasCronJobs = dashBody.includes("Cron Jobs") || dashBody.includes("Actions");
      const hasApiQuotas = dashBody.includes("API Quotas");
      const hasFeedbackLink = dashBody.includes("Feedback") && (await page.locator('a[href="/admin/feedback"]').count()) > 0;

      results.push({
        step: "STEP 2: Admin Dashboard",
        pass: hasStatCards && hasFeedbackLink,
        details: `Stat cards: ${hasStatCards ? "Yes" : "No"}. Scraper health: ${hasScraperHealth ? "Yes" : "No"}. Cron jobs: ${hasCronJobs ? "Yes" : "No"}. API quotas: ${hasApiQuotas ? "Yes" : "No"}. Feedback link in sidebar: ${hasFeedbackLink ? "Yes" : "No"}`,
        issues:
          !hasFeedbackLink || !hasStatCards
            ? [(!hasFeedbackLink && "Feedback link not found in sidebar") || (!hasStatCards && "Stat cards not visible")].filter(Boolean)
            : undefined,
      });

      // ========== STEP 3: Admin Feedback Page ==========
      console.log("STEP 3: Admin Feedback Page...");
      await page.goto(`${BASE_URL}/admin/feedback`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-feedback.png"),
        fullPage: true,
      });
      const feedbackBody = (await page.textContent("body")) || "";
      const hasUserFeedbackHeading = feedbackBody.includes("User Feedback");
      const hasStatusFilters = feedbackBody.includes("All") && feedbackBody.includes("New") && feedbackBody.includes("Reviewed") && feedbackBody.includes("Resolved") && feedbackBody.includes("Dismissed");
      const hasTypeFilters = feedbackBody.includes("Bug") && feedbackBody.includes("Suggestion") && feedbackBody.includes("Compliment") && feedbackBody.includes("Other");
      const hasEmptyState = feedbackBody.includes("No feedback yet") || feedbackBody.includes("User feedback will appear here");

      results.push({
        step: "STEP 3: Admin Feedback Page",
        pass: hasUserFeedbackHeading && (hasStatusFilters || hasTypeFilters) && (hasEmptyState || feedbackBody.includes("total")),
        details: `User Feedback heading: ${hasUserFeedbackHeading ? "Yes" : "No"}. Status filters (All, New, Reviewed, Resolved, Dismissed): ${hasStatusFilters ? "Yes" : "No"}. Type filters (Bug, Suggestion, Compliment, Other): ${hasTypeFilters ? "Yes" : "No"}. Empty state: ${hasEmptyState ? "Yes" : "No (may have feedback)"}`,
        issues:
          !hasUserFeedbackHeading || (!hasStatusFilters && !hasTypeFilters)
            ? [(!hasUserFeedbackHeading && "User Feedback heading not found") || ((!hasStatusFilters || !hasTypeFilters) && "Filter buttons not visible")].filter(Boolean)
            : undefined,
      });

      // ========== STEP 4: Admin Scrapers Page ==========
      console.log("STEP 4: Admin Scrapers Page...");
      await page.goto(`${BASE_URL}/admin/scrapers`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-scrapers.png"),
        fullPage: true,
      });
      const scrapersBody = (await page.textContent("body")) || "";
      const hasScraperCards = scrapersBody.includes("Scraper") || scrapersBody.includes("health") || scrapersBody.includes("LinkedIn") || scrapersBody.includes("Indeed") || scrapersBody.includes("jobs");

      results.push({
        step: "STEP 4: Admin Scrapers Page",
        pass: hasScraperCards || scrapersBody.includes("Scrapers"),
        details: `Scraper cards with health status: ${hasScraperCards ? "Yes" : "No"}`,
        issues: !hasScraperCards && !scrapersBody.includes("Scrapers") ? ["Scraper cards or page content not visible"] : undefined,
      });

      // ========== STEP 5: Admin Users Page ==========
      console.log("STEP 5: Admin Users Page...");
      await page.goto(`${BASE_URL}/admin/users`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-users.png"),
        fullPage: true,
      });
      const usersBody = (await page.textContent("body")) || "";
      const hasUsersContent = usersBody.includes("Users") || usersBody.includes("user") || usersBody.includes("email");

      results.push({
        step: "STEP 5: Admin Users Page",
        pass: hasUsersContent,
        details: `Users page loaded: ${hasUsersContent ? "Yes" : "No"}`,
        issues: !hasUsersContent ? ["Users page content not visible"] : undefined,
      });

      // ========== STEP 6: Admin Logs Page ==========
      console.log("STEP 6: Admin Logs Page...");
      await page.goto(`${BASE_URL}/admin/logs`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-logs.png"),
        fullPage: true,
      });
      const logsBody = (await page.textContent("body")) || "";
      const hasLogsContent = logsBody.includes("Log") || logsBody.includes("log") || logsBody.includes("Activity");

      results.push({
        step: "STEP 6: Admin Logs Page",
        pass: hasLogsContent,
        details: `Logs page loaded: ${hasLogsContent ? "Yes" : "No"}`,
        issues: !hasLogsContent ? ["Logs page content not visible"] : undefined,
      });
    }
  } catch (err) {
    console.error("Test error:", err);
    results.push({
      step: "Test Execution",
      pass: false,
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
      issues: ["Test script encountered an error"],
    });
  } finally {
    await browser.close();
  }

  // ========== Generate Report ==========
  const report: string[] = [];
  report.push("# JobPilot Admin Panel Test Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Base URL: ${BASE_URL}`);
  report.push(`Credentials: ${ADMIN_USER} / ****`);
  report.push("");
  report.push("## Summary");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  report.push(`- **PASS:** ${passed}/${results.length}`);
  report.push(`- **FAIL:** ${failed}/${results.length}`);
  report.push("");
  report.push("## Screenshots");
  report.push(`Saved to \`./test-screenshots/admin/\``);
  report.push("");
  report.push("## Detailed Results");
  for (const r of results) {
    report.push(`### ${r.step}`);
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

  const reportPath = path.join(process.cwd(), "admin-test-report.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("\n" + report.join("\n"));
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch(console.error);
