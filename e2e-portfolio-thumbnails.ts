/**
 * Capture hero screenshots for portfolio project cards
 * Run: npx tsx e2e-portfolio-thumbnails.ts
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = "c:\\Ali\\Pro\\portfolio-screenshots";

async function captureHero(url: string, outputPath: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(4000);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    await page.screenshot({
      path: outputPath,
      fullPage: false,
    });
    console.log("Saved:", outputPath);
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR))
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  await captureHero(
    "https://job-auto-applier-three.vercel.app/",
    path.join(OUTPUT_DIR, "jobpilot-hero.png")
  );

  await captureHero(
    "https://care-giving-web.vercel.app/",
    path.join(OUTPUT_DIR, "carecircle-hero.png")
  );

  console.log("\nDone. Screenshots saved to:", OUTPUT_DIR);
}

main().catch(console.error);
