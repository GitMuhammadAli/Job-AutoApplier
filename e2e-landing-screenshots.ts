/**
 * Capture landing page screenshots at top, middle, and bottom
 * Run: npx tsx e2e-landing-screenshots.ts
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://job-auto-applier-three.vercel.app";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR))
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const report: string[] = [];
  report.push("# JobPilot Landing Page Screenshot Report");
  report.push(`Generated: ${new Date().toISOString()}\n`);

  try {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const url = page.url();

    if (url.includes("/login")) {
      report.push("## Result: Redirected to Login");
      report.push(
        "The root URL redirected to /login. Landing page was not visible.",
      );
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "landing-01-login.png"),
        fullPage: true,
      });
    } else {
      // 1. Top of page
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "landing-01-top.png"),
        fullPage: false,
      });
      report.push("## 1. Top of page (saved: landing-01-top.png)");

      const hasNavbar =
        (await page.locator("text=JobPilot").first().count()) > 0;
      const hasHeadline =
        (await page.locator("text=Stop Applying Blindly").count()) > 0;
      const hasKanban = (await page.locator("text=Job Pipeline").count()) > 0;
      report.push("- Navbar with JobPilot: " + (hasNavbar ? "Yes" : "No"));
      report.push("- Hero headline: " + (hasHeadline ? "Yes" : "No"));
      report.push("- Mock Kanban: " + (hasKanban ? "Yes" : "No"));

      // 2. Scroll ~25% - Pain points / problems section
      const scrollHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      let scrollPos = Math.floor(scrollHeight * 0.25);
      await page.evaluate((y) => window.scrollTo(0, y), scrollPos);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "landing-02-problems.png"),
        fullPage: false,
      });
      report.push("\n## 2. ~25% scroll - Problems section (saved: landing-02-problems.png)");

      // 3. Scroll ~40% - Features section
      scrollPos = Math.floor(scrollHeight * 0.4);
      await page.evaluate((y) => window.scrollTo(0, y), scrollPos);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "landing-03-features.png"),
        fullPage: false,
      });
      report.push("\n## 3. ~40% scroll - Features (saved: landing-03-features.png)");

      const bodyMid = (await page.textContent("body")) || "";
      const hasFeatures =
        bodyMid.includes("Features") ||
        bodyMid.includes("How It Works") ||
        bodyMid.includes("Modes");
      report.push(
        "- Features/How It Works/Modes visible: " +
          (hasFeatures ? "Yes" : "No"),
      );

      // 4. Scroll ~65% - Automation modes / How it works
      scrollPos = Math.floor(scrollHeight * 0.65);
      await page.evaluate((y) => window.scrollTo(0, y), scrollPos);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "landing-04-modes.png"),
        fullPage: false,
      });
      report.push("\n## 4. ~65% scroll - Modes / How it works (saved: landing-04-modes.png)");

      // 5. Bottom of page
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "landing-05-bottom.png"),
        fullPage: false,
      });
      report.push("\n## 5. Bottom of page (saved: landing-05-bottom.png)");

      const bodyBottom = (await page.textContent("body")) || "";
      const hasFooter =
        bodyBottom.includes("Footer") ||
        bodyBottom.includes("©") ||
        bodyBottom.includes("Privacy");
      report.push("- Footer/CTA visible: " + (hasFooter ? "Yes" : "Unknown"));
    }

    report.push("\n## Visual check");
    const bodyText = (await page.textContent("body")) || "";
    report.push("- Page loaded: " + (bodyText.length > 100 ? "Yes" : "No"));
  } catch (err) {
    report.push("## Error\n```\n" + String(err) + "\n```");
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SCREENSHOT_DIR, "LANDING-REPORT.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("Screenshots saved to:", SCREENSHOT_DIR);
  console.log("\n" + report.join("\n"));
}

main().catch(console.error);
