/**
 * Capture portfolio site screenshots at alishahid-dev.vercel.app
 * Run: npx tsx e2e-portfolio-screenshots.ts
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://alishahid-dev.vercel.app";
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
  report.push("# Portfolio Site Screenshot Report");
  report.push(`URL: ${BASE_URL}`);
  report.push(`Generated: ${new Date().toISOString()}\n`);

  try {
    await page.goto(BASE_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForTimeout(4000);

    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );

    // 1. TOP - Hero
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "portfolio-01-hero.png"),
      fullPage: false,
    });
    report.push("## 1. Hero (Top) - portfolio-01-hero.png");

    // 2. ~30%
    let y = Math.floor(scrollHeight * 0.3);
    await page.evaluate((n) => window.scrollTo(0, n), y);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "portfolio-02-30pct.png"),
      fullPage: false,
    });
    report.push("## 2. ~30% scroll - portfolio-02-30pct.png");

    // 3. ~60%
    y = Math.floor(scrollHeight * 0.6);
    await page.evaluate((n) => window.scrollTo(0, n), y);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "portfolio-03-60pct.png"),
      fullPage: false,
    });
    report.push("## 3. ~60% scroll - portfolio-03-60pct.png");

    // 4. ~80%
    y = Math.floor(scrollHeight * 0.8);
    await page.evaluate((n) => window.scrollTo(0, n), y);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "portfolio-04-80pct.png"),
      fullPage: false,
    });
    report.push("## 4. ~80% scroll - portfolio-04-80pct.png");

    // 5. Bottom
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "portfolio-05-bottom.png"),
      fullPage: false,
    });
    report.push("## 5. Bottom - portfolio-05-bottom.png");

    // Tech stack hints from DOM
    const html = await page.content();
    const hasReact = html.includes("__NEXT_DATA__") || html.includes("react");
    const hasNext = html.includes("__NEXT_DATA__");
    const bodyText = (await page.textContent("body")) || "";
    report.push("\n## DOM Hints");
    report.push(`- Next.js/React: ${hasNext ? "Likely" : "Unknown"}`);
    report.push(`- Body text length: ${bodyText.length} chars`);
  } catch (err) {
    report.push("## Error\n```\n" + String(err) + "\n```");
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SCREENSHOT_DIR, "PORTFOLIO-REPORT.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("Screenshots saved to:", SCREENSHOT_DIR);
  console.log("\n" + report.join("\n"));
}

main().catch(console.error);
