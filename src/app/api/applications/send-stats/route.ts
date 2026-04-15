import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getSendStats } from "@/lib/send-limiter";
import { APPLICATIONS, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const stats = await getSendStats(userId);
    return NextResponse.json(stats);
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
