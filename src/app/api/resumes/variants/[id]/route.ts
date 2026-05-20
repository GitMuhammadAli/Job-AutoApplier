/**
 * DELETE /api/resumes/variants/[id]  → remove a saved variant
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
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

  await prisma.resumeVariant.delete({ where: { id: variant.id } });
  return NextResponse.json({ ok: true });
}
