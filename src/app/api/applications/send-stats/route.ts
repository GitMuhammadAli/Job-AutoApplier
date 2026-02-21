import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getSendStats } from "@/lib/send-limiter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const stats = await getSendStats(userId);
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[SendStats] Error:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
