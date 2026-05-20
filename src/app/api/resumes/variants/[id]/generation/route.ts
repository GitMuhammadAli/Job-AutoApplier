/**
 * GET /api/resumes/variants/[id]/generation
 *
 * Returns the latest ResumeGeneration tied to this variant — used by the
 * VariantsTab to expose a one-click "Download PDF" without storing duplicate
 * snapshots on the variant row.
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

  const variant = await prisma.resumeVariant.findUnique({
    where: { id: params.id },
    include: { profile: { select: { userId: true } } },
  });
  if (!variant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (variant.profile.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const generation = await prisma.resumeGeneration.findFirst({
    where: { variantId: variant.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, templateId: true, pageTarget: true, createdAt: true },
  });
  if (!generation) {
    return NextResponse.json({ error: "No generation linked yet" }, { status: 404 });
  }

  return NextResponse.json({
    generationId: generation.id,
    templateId: generation.templateId,
    pageTarget: generation.pageTarget,
    createdAt: generation.createdAt,
    previewUrl: `/api/resumes/generations/${generation.id}/preview`,
    pdfUrl: `/api/resumes/generations/${generation.id}/pdf`,
  });
}
