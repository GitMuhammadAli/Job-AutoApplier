/**
 * GET /api/resumes/generations/[id]/preview
 *
 * Returns the cached htmlSnapshot from a ResumeGeneration row as HTML.
 * UI iframes this URL to show a faithful preview that matches the PDF
 * byte-for-byte (because the PDF route just rasterizes this same HTML).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();

  const generation = await prisma.resumeGeneration.findUnique({
    where: { id: params.id },
    select: { userId: true, htmlSnapshot: true },
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

  return new NextResponse(generation.htmlSnapshot, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
