/**
 * HTML → PDF rendering via playwright-core.
 *
 * Dual-environment Chromium:
 *   - Local / non-Vercel : `npx playwright install chromium` once, default launch
 *   - Vercel serverless  : @sparticuz/chromium-min binary + args (auto-detected)
 *
 * Detection: `process.env.VERCEL === "1"` (Vercel sets this for every build/runtime).
 *
 * Shared by:
 *   - GET /api/resumes/generations/[id]/pdf  (interactive download)
 *   - sendApplication                        (auto-apply attachment)
 *   - GET /api/cron/resume-warmup            (keeps Chromium warm on Vercel)
 */

const RENDER_TIMEOUT_MS = 25_000;
const IS_VERCEL = process.env.VERCEL === "1";

export class ChromiumNotInstalledError extends Error {
  constructor() {
    super("Chromium not installed. Run `npx playwright install chromium`.");
    this.name = "ChromiumNotInstalledError";
  }
}

async function launchBrowser() {
  // Dynamic imports so missing optional binaries don't break compile.
  const { chromium } = await import("playwright-core");

  if (IS_VERCEL) {
    // Vercel: use Sparticuz's slim Chromium (matches Lambda's runtime).
    const sparticuz = await import("@sparticuz/chromium");
    const executablePath = await sparticuz.default.executablePath();
    return chromium.launch({
      args: sparticuz.default.args,
      executablePath,
      headless: true,
    });
  }

  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Executable doesn't exist")) {
      throw new ChromiumNotInstalledError();
    }
    throw err;
  }
}

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
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

/**
 * Warm up Chromium so the next user-triggered render doesn't pay the
 * cold-start tax. Cheap: launch + close, no rendering.
 *
 * Called by /api/cron/resume-warmup (Vercel cron) every few minutes during
 * peak hours, OR by sendApplication via a fire-and-forget call before the
 * first request of a function instance.
 */
export async function warmupChromium(): Promise<{
  ok: boolean;
  ms: number;
  environment: "vercel" | "local";
  error?: string;
}> {
  const t0 = Date.now();
  try {
    const browser = await launchBrowser();
    await browser.close();
    return {
      ok: true,
      ms: Date.now() - t0,
      environment: IS_VERCEL ? "vercel" : "local",
    };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      environment: IS_VERCEL ? "vercel" : "local",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
