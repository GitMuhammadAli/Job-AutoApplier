import { NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth";
import { getSendStats } from "@/lib/send-limiter";
import { APPLICATIONS, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
    const stats = await getSendStats(userId);
    // Polled by ApplicationQueue + QuickApplyPanel. 20s cache + 60s SWR
    // collapses back-nav refetches without staling per-send-cap badly.
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }
    console.error("[SendStats] Error:", error);
    return NextResponse.json(
      { error: APPLICATIONS.FAILED_GET_STATS },
      { status: 500 }
    );
  }
}
