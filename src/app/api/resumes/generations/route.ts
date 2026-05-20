/**
 * GET /api/resumes/generations
 *
 * Lists the user's resume-generation history, most-recent first.
 * UI: the History tab.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getAuthUserId();

  const profile = await prisma.resumeProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ generations: [] });
  }

  const generations = await prisma.resumeGeneration.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      templateId: true,
      templateVersion: true,
      pageTarget: true,
      jdSnippet: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ generations });
}
