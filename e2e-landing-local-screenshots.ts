/**
 * Capture landing page screenshots at localhost:3000 with visual effect checks
 * Run: npx tsx e2e-landing-local-screenshots.ts
 * Requires: npm run dev (port 3000) running
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.LANDING_URL || "http://localhost:3000";
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
  report.push("# JobPilot Landing Page - Localhost Visual Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`URL: ${BASE_URL}\n`);

  try {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait 3-4 seconds for full load (animations, particles, etc.)
    await page.waitForTimeout(4000);

    const url = page.url();

    if (url.includes("/login") || url.includes("/dashboard")) {
      report.push("## Result: Redirected");
      report.push(`Page redirected to: ${url}. Landing page was not visible.`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-01-redirect.png"),
        fullPage: false,
      });
    } else {
      const scrollHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );

      // 1. TOP - Hero section
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-01-hero.png"),
        fullPage: false,
      });
      report.push("## 1. Hero (Top) - local-01-hero.png");

      // 2. LogoBar / Marquee section
      const logoBarY = Math.min(scrollHeight * 0.15, 900);
      await page.evaluate((y) => window.scrollTo(0, y), logoBarY);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-02-marquee.png"),
        fullPage: false,
      });
      report.push("## 2. LogoBar / Marquee - local-02-marquee.png");

      // 3. ProblemSolution section
      const problemY = Math.min(scrollHeight * 0.28, 1400);
      await page.evaluate((y) => window.scrollTo(0, y), problemY);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-03-problems.png"),
        fullPage: false,
      });
      report.push("## 3. ProblemSolution - local-03-problems.png");

      // 4. Features section (with 3D cards)
      const featuresY = Math.min(scrollHeight * 0.42, 2100);
      await page.evaluate((y) => window.scrollTo(0, y), featuresY);
      await page.waitForTimeout(500);
      // Hover over first feature card to capture hover effect
      const featureCard = page.locator('[style*="preserve-3d"]').first();
      if ((await featureCard.count()) > 0) {
        await featureCard.hover();
        await page.waitForTimeout(300);
      }
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-04-features.png"),
        fullPage: false,
      });
      report.push("## 4. Features (3D cards) - local-04-features.png");

      // 5. HowItWorks / Modes section
      const modesY = Math.min(scrollHeight * 0.58, 2900);
      await page.evaluate((y) => window.scrollTo(0, y), modesY);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-05-modes.png"),
        fullPage: false,
      });
      report.push("## 5. HowItWorks / Modes - local-05-modes.png");

      // 6. Stats / Testimonials / CTA / Footer
      const bottomY = scrollHeight - 400;
      await page.evaluate((y) => window.scrollTo(0, y), bottomY);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "local-06-bottom.png"),
        fullPage: false,
      });
      report.push("## 6. Stats / CTA / Footer - local-06-bottom.png");

      // Visual checks
      report.push("\n## Visual Effect Checks");
      const bodyText = (await page.textContent("body")) || "";
      const hasParticles = (await page.locator("canvas").count()) > 0;
      const hasOrbs = bodyText.length > 100; // GlowingOrbs are divs, check DOM
      const hasGradientText = bodyText.includes("Landing") || bodyText.includes("Interviews");
      const hasMarquee = bodyText.includes("Indeed") || bodyText.includes("LinkedIn");
      const has3DCards = (await page.locator('[style*="preserve-3d"]').count()) > 0;

      report.push(`- Canvas (ParticleField): ${hasParticles ? "Yes" : "No"}`);
      report.push(`- Gradient text (Hero): ${hasGradientText ? "Yes" : "No"}`);
      report.push(`- Marquee (LogoBar): ${hasMarquee ? "Yes" : "No"}`);
      report.push(`- 3D cards (Tilt3D/Feature3DCard): ${has3DCards ? "Yes" : "No"}`);
    }

    // Console errors
    const errors = consoleLogs.filter((m) => m.type === "error");
    const warnings = consoleLogs.filter((m) => m.type === "warning");
    report.push("\n## Console");
    report.push(`- Errors: ${errors.length}`);
    report.push(`- Warnings: ${warnings.length}`);
    if (errors.length > 0) {
      report.push("\n### Errors:");
      errors.slice(0, 10).forEach((e) => report.push(`  - ${e.text}`));
    }
    if (warnings.length > 0 && warnings.length <= 5) {
      report.push("\n### Warnings:");
      warnings.forEach((w) => report.push(`  - ${w.text}`));
    }
  } catch (err) {
    report.push("## Error\n```\n" + String(err) + "\n```");
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SCREENSHOT_DIR, "LOCAL-LANDING-REPORT.md");
  fs.writeFileSync(reportPath, report.join("\n"), "utf-8");
  console.log("Screenshots saved to:", SCREENSHOT_DIR);
  console.log("\n" + report.join("\n"));
}

main().catch(console.error);
