/**
 * Capture landing page screenshots at top, middle, and bottom
 * Run: npx tsx e2e-landing-screenshots.ts
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3002";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

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
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
    const url = page.url();

    if (url.includes("/login")) {
      report.push("## Result: Redirected to Login");
      report.push("The root URL redirected to /login. Landing page was not visible.");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "landing-01-login.png"), fullPage: true });
    } else {
      // 1. Top of page
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "landing-01-top.png"), fullPage: false });
      report.push("## 1. Top of page (saved: landing-01-top.png)");

      const hasNavbar = (await page.locator("text=JobPilot").first().count()) > 0;
      const hasHeadline = (await page.locator("text=Stop Applying Blindly").count()) > 0;
      const hasKanban = (await page.locator("text=Job Pipeline").count()) > 0;
      report.push("- Navbar with JobPilot: " + (hasNavbar ? "Yes" : "No"));
      report.push("- Hero headline: " + (hasHeadline ? "Yes" : "No"));
      report.push("- Mock Kanban: " + (hasKanban ? "Yes" : "No"));

      // 2. Middle of page
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const midScroll = Math.floor(scrollHeight * 0.4);
      await page.evaluate((y) => window.scrollTo(0, y), midScroll);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "landing-02-middle.png"), fullPage: false });
      report.push("\n## 2. Middle of page (saved: landing-02-middle.png)");

      const bodyMid = await page.textContent("body") || "";
      const hasFeatures = bodyMid.includes("Features") || bodyMid.includes("How It Works") || bodyMid.includes("Modes");
      report.push("- Features/How It Works/Modes visible: " + (hasFeatures ? "Yes" : "No"));

      // 3. Bottom of page
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "landing-03-bottom.png"), fullPage: false });
      report.push("\n## 3. Bottom of page (saved: landing-03-bottom.png)");

      const bodyBottom = await page.textContent("body") || "";
      const hasFooter = bodyBottom.includes("Footer") || bodyBottom.includes("©") || bodyBottom.includes("Privacy");
      report.push("- Footer/CTA visible: " + (hasFooter ? "Yes" : "Unknown"));
    }

    report.push("\n## Visual check");
    const bodyText = await page.textContent("body") || "";
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
