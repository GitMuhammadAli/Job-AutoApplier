/**
 * GET /api/resumes/generations
 *
 * Lists the user's resume-generation history, most-recent first.
 * UI: the History tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();

  const favoritesOnly = new URL(req.url).searchParams.get("favorites") === "1";

  const generations = await prisma.resumeGeneration.findMany({
    where: { userId, ...(favoritesOnly ? { isFavorite: true } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      templateId: true,
      templateVersion: true,
      pageTarget: true,
      name: true,
      isFavorite: true,
      jdSnippet: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ generations });
}
