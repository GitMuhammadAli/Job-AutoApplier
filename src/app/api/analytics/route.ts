import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { LIMITS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const userJobs = await prisma.userJob.findMany({
      where: { userId, isDismissed: false },
      take: LIMITS.ANALYTICS_MAX_ROWS,
    });

    const totalJobs = userJobs.length;
    const applied = userJobs.filter((j) => j.stage !== "SAVED").length;
    const interviews = userJobs.filter((j) => j.stage === "INTERVIEW").length;
    const offers = userJobs.filter((j) => j.stage === "OFFER").length;
    const rejected = userJobs.filter((j) => j.stage === "REJECTED").length;
    const ghosted = userJobs.filter((j) => j.stage === "GHOSTED").length;
    const responseRate =
      applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

    return NextResponse.json({
      totalJobs,
      applied,
      interviews,
      offers,
      rejected,
      ghosted,
      responseRate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
