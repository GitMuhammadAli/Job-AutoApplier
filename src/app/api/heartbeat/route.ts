import { NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
    await prisma.userSettings.update({
      where: { userId },
      data: { lastVisitedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
