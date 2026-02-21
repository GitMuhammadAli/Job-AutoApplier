/**
 * E2E Browser Test for JobPilot
 * Run: npx tsx e2e-browser-test.ts
 * Screenshots saved to ./test-screenshots/
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3002";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const authFile = path.join(process.cwd(), ".auth", "user.json");
  const useAuth = fs.existsSync(authFile);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    ...(useAuth ? { storageState: authFile } : {}),
  });
  const page = await context.newPage();

  const report: string[] = [];
  report.push("# JobPilot E2E Browser Test Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(
    "- **Auth state:** " +
      (useAuth ? "Loaded from .auth/user.json" : "None (fresh browser)"),
  );
  report.push("");

  try {
    // 1. Dashboard (/) - try first without auth
    report.push("## 1. Dashboard (/)");
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-dashboard.png"),
      fullPage: true,
    });
    const url1 = page.url();
    const isLogin = url1.includes("/login");
    if (isLogin) {
      report.push("- **Result:** Redirected to login (auth required)");
      report.push("- **URL:** " + url1);
      const hasGoogle =
        (await page.locator("text=Continue with Google").count()) > 0;
      const hasGitHub =
        (await page.locator("text=Continue with GitHub").count()) > 0;
      const hasEmail = (await page.locator("text=Send Magic Link").count()) > 0;
      report.push(
        "- **Login page elements:** Google=" +
          hasGoogle +
          ", GitHub=" +
          hasGitHub +
          ", Email=" +
          hasEmail,
      );
    } else {
      report.push("- **Result:** Dashboard loaded");
      report.push("- **URL:** " + url1);
      const hasKanban = (await page.locator("text=Job Pipeline").count()) > 0;
      report.push("- **Kanban visible:** " + (hasKanban ? "Yes" : "Unknown"));
      const bodyText = (await page.textContent("body")) || "";
      const jobCards = await page.locator('a[href*="/jobs/"]').count();
      report.push("- **Job cards (approx):** " + jobCards);
      const hasFullStack = bodyText.includes("Full Stack");
      const hasSeniorReact = bodyText.includes("Senior React");
      const hasCopywriter = bodyText.includes("Copywriter");
      const hasInsideSales = bodyText.includes("Inside Sales");
      const hasOfficeAssistant = bodyText.includes("Office Assistant");
      report.push(
        "- **Expected jobs (Full Stack, Senior React):** " +
          (hasFullStack || hasSeniorReact ? "Yes" : "No"),
      );
      report.push(
        "- **Excluded jobs (Copywriter, Inside Sales, Office Assistant):** " +
          (hasCopywriter || hasInsideSales || hasOfficeAssistant
            ? "FOUND (should NOT appear)"
            : "Correctly absent"),
      );
      const hasMatchScore =
        bodyText.includes("%") || bodyText.includes("Match");
      const hasSourceBadge =
        bodyText.includes("LinkedIn") ||
        bodyText.includes("Indeed") ||
        bodyText.includes("JSearch");
      report.push(
        "- **Match score visible:** " + (hasMatchScore ? "Yes" : "Unknown"),
      );
      report.push(
        "- **Source badge visible:** " + (hasSourceBadge ? "Yes" : "Unknown"),
      );
    }
    report.push("");

    // 2. Applications
    report.push("## 2. Applications (/applications)");
    await page.goto(`${BASE_URL}/applications`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-applications.png"),
      fullPage: true,
    });
    const url2 = page.url();
    const appsIsLogin = url2.includes("/login");
    report.push(
      "- **Result:** " + (appsIsLogin ? "Redirected to login" : "Page loaded"),
    );
    report.push("- **URL:** " + url2);
    if (!appsIsLogin) {
      const hasTabs =
        (await page
          .locator('[role="tablist"], [data-state="active"]')
          .count()) > 0;
      report.push("- **Tabs visible:** " + (hasTabs ? "Yes" : "Unknown"));
    }
    report.push("");

    // 3. Templates
    report.push("## 3. Templates (/templates)");
    await page.goto(`${BASE_URL}/templates`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-templates.png"),
      fullPage: true,
    });
    const url3 = page.url();
    const templatesIsLogin = url3.includes("/login");
    report.push(
      "- **Result:** " +
        (templatesIsLogin ? "Redirected to login" : "Page loaded"),
    );
    report.push("- **URL:** " + url3);
    if (!templatesIsLogin) {
      const templateCount = await page
        .locator(
          "text=Professional Standard, text=Confident, text=Referral, text=Short",
        )
        .count();
      const templateText = (await page.textContent("body")) || "";
      const hasProfessional = templateText.includes("Professional");
      const hasConfident = templateText.includes("Confident");
      report.push(
        "- **Templates visible:** Professional=" +
          hasProfessional +
          ", Confident=" +
          hasConfident,
      );
    }
    report.push("");

    // 4. Analytics
    report.push("## 4. Analytics (/analytics)");
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-analytics.png"),
      fullPage: true,
    });
    const url4 = page.url();
    const analyticsIsLogin = url4.includes("/login");
    report.push(
      "- **Result:** " +
        (analyticsIsLogin ? "Redirected to login" : "Page loaded"),
    );
    report.push("- **URL:** " + url4);
    if (!analyticsIsLogin) {
      const hasCharts = (await page.locator("svg").count()) > 0;
      report.push("- **Charts (SVG) visible:** " + (hasCharts ? "Yes" : "No"));
    }
    report.push("");

    // 5. Settings
    report.push("## 5. Settings (/settings)");
    await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-settings.png"),
      fullPage: true,
    });
    const url5 = page.url();
    const settingsIsLogin = url5.includes("/login");
    report.push(
      "- **Result:** " +
        (settingsIsLogin ? "Redirected to login" : "Page loaded"),
    );
    report.push("- **URL:** " + url5);
    if (!settingsIsLogin) {
      const hasForm = (await page.locator("form, input, button").count()) > 0;
      report.push(
        "- **Settings form visible:** " + (hasForm ? "Yes" : "Unknown"),
      );
    }
    report.push("");

    // Dark mode check
    report.push("## Dark Mode");
    const htmlClass = await page.evaluate(
      () => document.documentElement.className,
    );
    report.push("- **HTML class:** " + (htmlClass || "(none)"));
    report.push(
      "- **Theme:** " + (htmlClass.includes("dark") ? "Dark" : "Light"),
    );
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
