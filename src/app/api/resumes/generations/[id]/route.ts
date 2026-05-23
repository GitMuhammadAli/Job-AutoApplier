/**
 * PATCH /api/resumes/generations/[id]   { name?, isFavorite? }
 * DELETE /api/resumes/generations/[id]
 *
 * Owns the favorite + rename actions for a saved generation (the variant
 * concept folded into ResumeGeneration after the schema flatten).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PatchBody = z.object({
  name: z.string().trim().max(60).nullable().optional(),
  isFavorite: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const gen = await prisma.resumeGeneration.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gen.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.resumeGeneration.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, isFavorite: true },
  });
  return NextResponse.json({ generation: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
  const gen = await prisma.resumeGeneration.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gen.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.resumeGeneration.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
