import { NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERIC, SETTINGS } from "@/lib/messages";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { applicationMode: true, accountStatus: true },
    });
    return NextResponse.json({
      mode: settings?.applicationMode || "MANUAL",
      status: settings?.accountStatus || "active",
    }, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === GENERIC.NOT_AUTHENTICATED || message.includes("Unauthorized")) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }
    await captureError(error, { route: "/api/settings/mode" });
    return NextResponse.json({ error: SETTINGS.FAILED_LOAD_MODE }, { status: 500 });
  }
}
