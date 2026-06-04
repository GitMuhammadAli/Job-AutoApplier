/**
 * GET /api/resumes/generations/[id]/preview
 *
 * Returns the cached htmlSnapshot from a ResumeGeneration row as HTML.
 * UI iframes this URL to show a faithful preview that matches the PDF
 * byte-for-byte (because the PDF route just rasterizes this same HTML).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;

  const generation = await prisma.resumeGeneration.findUnique({
    where: { id: params.id },
    select: { userId: true, htmlSnapshot: true },
  });

  if (!generation) {
    return NextResponse.json({ error: GENERIC.NOT_FOUND }, { status: 404 });
  }
  if (generation.userId !== userId) {
    return NextResponse.json({ error: GENERIC.FORBIDDEN }, { status: 403 });
  }
  if (!generation.htmlSnapshot) {
    return NextResponse.json(
      {
        error: "This resume's snapshot is gone. Re-generate it from /resumes.",
        code: "SNAPSHOT_MISSING",
      },
      { status: 410 },
    );
  }

  return new NextResponse(generation.htmlSnapshot, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
