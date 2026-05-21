/**
 * GET /api/resumes/generations/[id]/pdf
 *
 * Stream-on-demand PDF rendering. Reads htmlSnapshot from the generation row,
 * launches Chromium via playwright-core, prints to PDF, streams response.
 *
 * Setup requirement (one time, local dev):
 *     npx playwright install chromium
 *
 * For Vercel deploy: bundle @sparticuz/chromium-min OR point at a remote
 * Chromium endpoint via PLAYWRIGHT_BROWSERS_PATH. Not configured in v1.
 *
 * Reliability:
 *   - 30s hard cap on render. Vercel function timeout would kill us otherwise.
 *   - Falls back to a clear 503 error if Chromium isn't available, so the UI
 *     can surface a remediation hint to the user instead of a generic crash.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RENDER_TIMEOUT_MS = 25_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();

  const generation = await prisma.resumeGeneration.findUnique({
    where: { id: params.id },
    include: { user: { include: { settings: { select: { fullName: true } } } } },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (generation.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!generation.htmlSnapshot) {
    return NextResponse.json({ error: "Snapshot missing" }, { status: 410 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderPdfFromHtml(generation.htmlSnapshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF render failed";
    const code = msg.includes("Executable doesn't exist")
      ? "CHROMIUM_NOT_INSTALLED"
      : "RENDER_FAILED";
    return NextResponse.json(
      {
        error: msg,
        code,
        hint:
          code === "CHROMIUM_NOT_INSTALLED"
            ? "Run `npx playwright install chromium` once on the server."
            : undefined,
      },
      { status: 503 },
    );
  }

  const filename = sanitizeFilename(
    `${generation.user.settings?.fullName ?? generation.user.name ?? "resume"}_${generation.templateId}.pdf`,
  );

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

async function renderPdfFromHtml(html: string): Promise<Buffer> {
  // Dynamic import so the route compiles even when playwright-core
  // browsers aren't installed locally.
  const { chromium } = await import("playwright-core");

  const browser = await chromium.launch({ headless: true });
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

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}
