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
import { requireAuthUserId } from "@/lib/auth";
import { renderPdfFromHtml, ChromiumNotInstalledError } from "@/lib/resume/pdf";
import { GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;

  const generation = await prisma.resumeGeneration.findUnique({
    where: { id: params.id },
    include: { user: { include: { settings: { select: { fullName: true } } } } },
  });

  if (!generation) {
    return NextResponse.json({ error: GENERIC.NOT_FOUND }, { status: 404 });
  }
  if (generation.userId !== userId) {
    return NextResponse.json({ error: GENERIC.FORBIDDEN }, { status: 403 });
  }
  if (!generation.htmlSnapshot) {
    // 410 Gone — the row exists but its rendered HTML was dropped, so the
    // user needs to re-generate.
    return NextResponse.json(
      {
        error: "This resume's snapshot is gone. Re-generate it from /resumes.",
        code: "SNAPSHOT_MISSING",
      },
      { status: 410 },
    );
  }

  let pdf: Buffer;
  try {
    pdf = await renderPdfFromHtml(generation.htmlSnapshot);
  } catch (err) {
    if (err instanceof ChromiumNotInstalledError) {
      return NextResponse.json(
        {
          error: "PDF rendering isn't available right now.",
          code: "CHROMIUM_NOT_INSTALLED",
          hint: "Run `npx playwright install chromium` once on the server.",
        },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "PDF render failed.";
    return NextResponse.json(
      {
        error: "The PDF didn't come out right. Try generating again — sometimes a different template helps.",
        code: "RENDER_FAILED",
        hint: msg.slice(0, 200),
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

// Was: a second copy of renderPdfFromHtml inlined here that called
// chromium.launch({ headless: true }) directly. On Vercel, that would
// crash because Vercel's serverless runtime needs @sparticuz/chromium
// (with its own executablePath + args). The version in @/lib/resume/pdf
// auto-detects VERCEL=1 and routes accordingly. Importing it instead of
// duplicating means both /api/resumes/generations/[id]/pdf and
// sendApplication's attachment renderer go through the same Vercel-aware
// path — no behavior drift, no env-specific surprise crashes.

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}
