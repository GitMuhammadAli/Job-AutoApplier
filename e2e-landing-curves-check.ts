/**
 * Check flowing curves/blobs vs particle dots on landing page
 * Run: npx tsx e2e-landing-curves-check.ts
 * Requires: dev server on port 3002
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3002";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");

interface ConsoleMessage {
  type: string;
  text: string;
}

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR))
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleLogs: ConsoleMessage[] = [];
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text });
  });

  const report: string[] = [];
  report.push("# Landing Page - Curves/Blobs vs Particles Check");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`URL: ${BASE_URL}\n`);

  try {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait 4 seconds for full load
    await page.waitForTimeout(4000);

    const url = page.url();

    if (url.includes("/login") || url.includes("/dashboard")) {
      report.push("## Result: Redirected");
      report.push(`Page redirected to: ${url}.`);
    } else {
      const scrollHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );

      // 1. TOP - Hero section
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "curves-01-hero.png"),
        fullPage: false,
      });
      report.push("## 1. Hero (Top) - curves-01-hero.png");

      // 2. Middle
      const midY = Math.floor(scrollHeight * 0.45);
      await page.evaluate((y) => window.scrollTo(0, y), midY);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "curves-02-middle.png"),
        fullPage: false,
      });
      report.push("## 2. Middle - curves-02-middle.png");

      // 3. Bottom CTA section
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight - 600),
      );
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "curves-03-cta.png"),
        fullPage: false,
      });
      report.push("## 3. CTA (Bottom) - curves-03-cta.png");

      // DOM checks
      report.push("\n## DOM Checks");
      const hasCanvas = (await page.locator("canvas").count()) > 0;
      const hasCurveSvg = (await page.locator('svg path[stroke*="url"]').count()) > 0;
      const hasMorphBlob = (await page.locator('[style*="morph-blob"]').count()) > 0;
      const svgPaths = await page.locator("svg path").count();

      report.push(`- Canvas (particle dots): ${hasCanvas ? "Yes" : "No"}`);
      report.push(`- SVG curves (path with gradient stroke): ${hasCurveSvg ? "Yes" : "No"}`);
      report.push(`- Morph-blob divs: ${hasMorphBlob ? "Yes" : "No"}`);
      report.push(`- Total SVG paths: ${svgPaths}`);
    }

    // Console
    const errors = consoleLogs.filter((m) => m.type === "error");
    const warnings = consoleLogs.filter((m) => m.type === "warning");
    report.push("\n## Console");
    report.push(`- Errors: ${errors.length}`);
    report.push(`- Warnings: ${warnings.length}`);
    if (errors.length > 0) {
      report.push("\n### Errors:");
      errors.slice(0, 10).forEach((e) => report.push(`  - ${e.text}`));
    }
  } catch (err) {
    report.push("## Error\n```\n" + String(err) + "\n```");
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SCREENSHOT_DIR, "CURVES-REPORT.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("Screenshots saved to:", SCREENSHOT_DIR);
  console.log("\n" + report.join("\n"));
}

main().catch(console.error);
