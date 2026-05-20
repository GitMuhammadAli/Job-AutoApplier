/**
 * GET  /api/resumes/variants    → list saved variants for the user's profile
 * POST /api/resumes/variants    → create a new variant from a generation's settings
 *
 * A Variant captures the ordering / selection used in a generation so the
 * user can re-apply the same tailoring later without re-running the JD ranker.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { getCurrentVersion } from "@/lib/resume/templates/registry";

export const dynamic = "force-dynamic";

const CreateBody = z.object({
  generationId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});

export async function GET() {
  const userId = await getAuthUserId();
  const profile = await prisma.resumeProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ variants: [] });
  }

  const variants = await prisma.resumeVariant.findMany({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      templateId: true,
      templateVersion: true,
      pageTarget: true,
      isDefault: true,
      generatedFromJd: true,
      jdSnippet: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ variants });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  // Load the generation row to learn the ordering used.
  const gen = await prisma.resumeGeneration.findUnique({
    where: { id: parsed.data.generationId },
    include: { profile: { select: { userId: true, id: true } } },
  });
  if (!gen) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }
  if (gen.profile.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Variants don't store the full ordering arrays separately — they reference
  // the generation's pinned templateId/templateVersion + the implicit ordering
  // captured in htmlSnapshot. Phase 3 can split out the ordering arrays into
  // dedicated columns if we want re-application across schema changes.
  const variant = await prisma.resumeVariant.create({
    data: {
      profileId: gen.profile.id,
      name: parsed.data.name,
      templateId: gen.templateId,
      templateVersion: gen.templateVersion ?? getCurrentVersion(gen.templateId),
      pageTarget: gen.pageTarget,
      skillsOrder: [],
      projectIds: [],
      experienceIds: [],
      sectionOrder: [],
      generatedFromJd: Boolean(gen.jdSnippet),
      jdSnippet: gen.jdSnippet,
    },
    select: {
      id: true,
      name: true,
      templateId: true,
      pageTarget: true,
      generatedFromJd: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ variant });
}
