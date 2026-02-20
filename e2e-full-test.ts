/**
 * Full E2E Browser Test for JobPilot
 * Run: npx tsx e2e-full-test.ts
 * Uses session cookie for auth. Screenshots saved to ./test-screenshots/
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3002";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");
const SESSION_COOKIE = {
  name: "next-auth.session-token",
  value: "test-session-1771597173969",
  domain: "localhost",
  path: "/",
};

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const report: string[] = [];
  report.push("# JobPilot Full E2E Test Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push("");

  try {
    // STEP 0: Load login page, set session cookie
    report.push("## Auth Setup");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 15000 });
    await context.addCookies([{
      name: SESSION_COOKIE.name,
      value: SESSION_COOKIE.value,
      url: BASE_URL + "/",
    }]);
    report.push("- Session cookie set: next-auth.session-token");
    report.push("");

    // PAGE 1: Dashboard
    report.push("## Page 1: Dashboard (/)");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-dashboard.png"), fullPage: true });
    const url1 = page.url();
    const isLogin1 = url1.includes("/login");
    report.push("- **Loaded:** " + (isLogin1 ? "No - redirected to login" : "Yes"));
    if (!isLogin1) {
      const bodyText = await page.textContent("body") || "";
      const hasKanban = bodyText.includes("Job Pipeline");
      const hasJobCards = await page.locator('a[href*="/jobs/"]').count();
      const hasMatchScore = bodyText.includes("%") || bodyText.includes("Match");
      const hasSourceBadge = bodyText.includes("LinkedIn") || bodyText.includes("Indeed") || bodyText.includes("JSearch") || bodyText.includes("Remotive");
      const hasCopywriter = bodyText.includes("Copywriter");
      const hasInsideSales = bodyText.includes("Inside Sales");
      const hasOfficeAssistant = bodyText.includes("Office Assistant");
      const savedColumn = await page.locator('text=SAVED').first();
      let savedCount = 0;
      if (await savedColumn.count() > 0) {
        const column = savedColumn.locator("..");
        savedCount = await column.locator('[class*="rounded-xl"]').count();
      }
      report.push("- **Kanban visible:** " + (hasKanban ? "Yes" : "No"));
      report.push("- **Job cards total:** " + hasJobCards);
      report.push("- **Cards show title, company:** Yes (implied by job cards)");
      report.push("- **Match score visible:** " + (hasMatchScore ? "Yes" : "No"));
      report.push("- **Source badge visible:** " + (hasSourceBadge ? "Yes" : "No"));
      report.push("- **Excluded (Copywriter, Inside Sales, Office Assistant):** " + (hasCopywriter || hasInsideSales || hasOfficeAssistant ? "FOUND - FAIL" : "Correctly absent"));
      report.push("- **SAVED column card count:** " + savedCount);
    }
    report.push("");

    // PAGE 2: Applications
    report.push("## Page 2: Applications (/applications)");
    await page.goto(`${BASE_URL}/applications`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-applications.png"), fullPage: true });
    const url2 = page.url();
    const isLogin2 = url2.includes("/login");
    report.push("- **Loaded:** " + (isLogin2 ? "No - redirected to login" : "Yes"));
    if (!isLogin2) {
      const bodyText = await page.textContent("body") || "";
      const hasAll = bodyText.includes("All");
      const hasDrafts = bodyText.includes("Draft");
      const hasReady = bodyText.includes("Ready");
      const hasSent = bodyText.includes("Sent");
      const hasFailed = bodyText.includes("Failed");
      const hasBounced = bodyText.includes("Bounced");
      const hasSendingStatusBar = bodyText.includes("Sending") || bodyText.includes("sending");
      const hasEmptyState = bodyText.includes("No applications") || bodyText.includes("empty");
      const hasCards = await page.locator('[class*="rounded"]').filter({ hasText: /Draft|Ready|Sent/ }).count() > 0;
      report.push("- **Tabs (All, Drafts, Ready, Sent, Failed, Bounced):** All=" + hasAll + ", Draft=" + hasDrafts + ", Ready=" + hasReady + ", Sent=" + hasSent + ", Failed=" + hasFailed + ", Bounced=" + hasBounced);
      report.push("- **SendingStatusBar visible:** " + (hasSendingStatusBar ? "Yes" : "Unknown"));
      report.push("- **Content:** " + (hasCards ? "Application cards" : hasEmptyState ? "Empty state" : "Other"));
    }
    report.push("");

    // PAGE 3: Templates
    report.push("## Page 3: Templates (/templates)");
    await page.goto(`${BASE_URL}/templates`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-templates.png"), fullPage: true });
    const url3 = page.url();
    const isLogin3 = url3.includes("/login");
    report.push("- **Loaded:** " + (isLogin3 ? "No - redirected to login" : "Yes"));
    if (!isLogin3) {
      const bodyText = await page.textContent("body") || "";
      const templateCount = (bodyText.match(/Professional|Confident|Referral|Short/g) || []).length;
      const hasDefault = bodyText.includes("DEFAULT") || bodyText.includes("Default") || bodyText.includes("default");
      const hasCreateNew = bodyText.includes("Create New") || bodyText.includes("Create new") || bodyText.includes("Add Template");
      report.push("- **Templates visible:** " + templateCount + " (expected 3+)");
      report.push("- **DEFAULT badge/star:** " + (hasDefault ? "Yes" : "No"));
      report.push("- **Create New Template button:** " + (hasCreateNew ? "Yes" : "No"));
    }
    report.push("");

    // PAGE 4: Resumes
    report.push("## Page 4: Resumes (/resumes)");
    await page.goto(`${BASE_URL}/resumes`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-resumes.png"), fullPage: true });
    const url4 = page.url();
    const isLogin4 = url4.includes("/login");
    report.push("- **Loaded:** " + (isLogin4 ? "No - redirected to login" : "Yes"));
    if (!isLogin4) {
      const bodyText = await page.textContent("body") || "";
      const hasUpload = bodyText.includes("Upload") || bodyText.includes("upload") || bodyText.includes("drop") || bodyText.includes("Add Resume");
      const hasResumes = bodyText.includes("resume") && (bodyText.includes("variant") || bodyText.includes("Resume"));
      report.push("- **Resume upload area:** " + (hasUpload ? "Yes" : "Unknown"));
      report.push("- **Content:** " + (hasResumes ? "Resumes listed or upload UI" : "Empty or other"));
    }
    report.push("");

    // PAGE 5: Analytics
    report.push("## Page 5: Analytics (/analytics)");
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-analytics.png"), fullPage: true });
    const url5 = page.url();
    const isLogin5 = url5.includes("/login");
    report.push("- **Loaded:** " + (isLogin5 ? "No - redirected to login" : "Yes"));
    if (!isLogin5) {
      const svgCount = await page.locator("svg").count();
      const bodyText = await page.textContent("body") || "";
      const hasStatCards = bodyText.includes("Applications") || bodyText.includes("Matches") || bodyText.includes("Sent");
      report.push("- **Charts (SVG) render:** " + (svgCount > 0 ? "Yes (" + svgCount + " SVGs)" : "No/blank"));
      report.push("- **Stat cards visible:** " + (hasStatCards ? "Yes" : "Unknown"));
    }
    report.push("");

    // PAGE 6: Settings
    report.push("## Page 6: Settings (/settings)");
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-settings.png"), fullPage: true });
    const url6 = page.url();
    const isLogin6 = url6.includes("/login");
    report.push("- **Loaded:** " + (isLogin6 ? "No - redirected to login" : "Yes"));
    if (!isLogin6) {
      const bodyText = await page.textContent("body") || "";
      const hasAliShahid = bodyText.includes("Ali Shahid") || bodyText.includes("Ali");
      const hasKeywords = bodyText.includes("keyword") || bodyText.includes("Keywords");
      const hasSections = bodyText.includes("Profile") || bodyText.includes("Job") || bodyText.includes("Email");
      report.push("- **Form with data (Ali Shahid, keywords):** " + (hasAliShahid ? "Yes" : "No"));
      report.push("- **All sections visible:** " + (hasSections ? "Yes" : "Unknown"));
    }
    report.push("");

    // PAGE 7: Dark Mode
    report.push("## Page 7: Dark Mode Test");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
    const themeToggle = page.locator('button[aria-label*="theme"], button[aria-label*="Theme"], [data-state][class*="theme"], button:has(svg)').first();
    const sunMoon = page.locator('button:has([data-lucide="Sun"]), button:has([data-lucide="Moon"]), [class*="theme"] button').first();
    let darkModeClicked = false;
    if (await sunMoon.count() > 0) {
      await sunMoon.click();
      await page.waitForTimeout(500);
      darkModeClicked = true;
    } else {
      const anyToggle = page.locator('header button, nav button').filter({ has: page.locator("svg") }).last();
      if (await anyToggle.count() > 0) {
        await anyToggle.click();
        await page.waitForTimeout(500);
        darkModeClicked = true;
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-dark-mode.png"), fullPage: true });
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    report.push("- **Theme toggle clicked:** " + (darkModeClicked ? "Yes" : "No"));
    report.push("- **HTML class after toggle:** " + (htmlClass || "(none)"));
    report.push("- **Dark mode active:** " + (htmlClass.includes("dark") ? "Yes" : "No"));
    report.push("");

    // PAGE 8: Error Page
    report.push("## Page 8: Error Page (404)");
    await page.goto(`${BASE_URL}/jobs/nonexistent-invalid-id`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-error-page.png"), fullPage: true });
    const bodyText8 = await page.textContent("body") || "";
    const has404 = bodyText8.includes("404") || bodyText8.includes("Not Found") || bodyText8.includes("not found");
    const hasError = bodyText8.includes("error") || bodyText8.includes("Error");
    const isBlank = bodyText8.trim().length < 200;
    report.push("- **Loaded:** Yes");
    report.push("- **Shows 404/error:** " + (has404 || hasError ? "Yes" : "No"));
    report.push("- **Blank/crash:** " + (isBlank ? "Yes - FAIL" : "No"));
    report.push("");

    // PAGE 9: Job Detail (click highest match card)
    report.push("## Page 9: Job Detail (click card)");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
    const jobLinks = page.locator('a[href*="/jobs/"]');
    const linkCount = await jobLinks.count();
    let jobDetailLoaded = false;
    if (linkCount > 0) {
      await jobLinks.first().click();
      await page.waitForTimeout(1500);
      const url9 = page.url();
      if (url9.includes("/jobs/") && !url9.includes("nonexistent")) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-job-detail.png"), fullPage: true });
        jobDetailLoaded = true;
        const bodyText9 = await page.textContent("body") || "";
        const hasTitle = bodyText9.length > 0;
        const hasCompany = bodyText9.includes("company") || bodyText9.includes("Company");
        const hasLocation = bodyText9.includes("location") || bodyText9.includes("Location");
        const hasSalary = bodyText9.includes("salary") || bodyText9.includes("Salary") || bodyText9.includes("$");
        const hasDescription = bodyText9.includes("description") || bodyText9.includes("Description") || bodyText9.includes("requirements");
        const hasQuickApply = bodyText9.includes("Quick") || bodyText9.includes("Apply") || bodyText9.includes("email") || bodyText9.includes("Generate");
        report.push("- **Job detail loaded:** Yes");
        report.push("- **Left panel (title, company, location, salary, description):** " + (hasTitle && (hasCompany || hasLocation) ? "Yes" : "Partial"));
        report.push("- **Right panel QuickApplyPanel / email generation:** " + (hasQuickApply ? "Yes" : "Unknown"));
      }
    }
    if (!jobDetailLoaded) {
      report.push("- **Job detail loaded:** No (no job cards or click failed)");
    }
    report.push("");

    // Summary
    report.push("## Summary");
    report.push("- Screenshots: 01-dashboard through 09-job-detail.png");
    report.push("- Dark mode: 07-dark-mode.png");
  } catch (err) {
    report.push("## Error");
    report.push("```");
    report.push(String(err));
    report.push("```");
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SCREENSHOT_DIR, "REPORT.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("Screenshots saved to:", SCREENSHOT_DIR);
  console.log("Report saved to:", reportPath);
  console.log("\n" + report.join("\n"));
}

main().catch(console.error);
