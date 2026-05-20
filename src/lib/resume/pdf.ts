/**
 * HTML → PDF rendering via playwright-core.
 *
 * Shared by:
 *   - GET /api/resumes/generations/[id]/pdf  (interactive user download)
 *   - sendApplication                        (auto-apply attaches the tailored PDF)
 *
 * One source of truth for browser options, timeouts, and margins.
 *
 * Setup (one time):  `npx playwright install chromium`
 */

const RENDER_TIMEOUT_MS = 25_000;

export class ChromiumNotInstalledError extends Error {
  constructor() {
    super("Chromium not installed. Run `npx playwright install chromium`.");
    this.name = "ChromiumNotInstalledError";
  }
}

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  // Dynamic import so the module loads even when playwright-core has no
  // browser binaries installed yet. We surface a typed error if the launch
  // fails for that reason.
  const { chromium } = await import("playwright-core");

  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Executable doesn't exist")) {
      throw new ChromiumNotInstalledError();
    }
    throw err;
  }

  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: RENDER_TIMEOUT_MS });
    const buffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close().catch(() => {});
  }
}
