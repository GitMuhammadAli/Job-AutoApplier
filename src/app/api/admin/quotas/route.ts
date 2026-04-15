import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

const QUOTA_LIMITS: Record<string, { daily: number; monthly: number }> = {
  jsearch: { daily: 100, monthly: 500 },
  adzuna: { daily: 250, monthly: 5000 },
  serpapi: { daily: 100, monthly: 500 },
  groq: { daily: 1000, monthly: 14400 },
  brevo: { daily: 300, monthly: 9000 },
};

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const quotas = await Promise.all(
      Object.entries(QUOTA_LIMITS).map(async ([name, limits]) => {
        const [dailyUsed, monthlyUsed] = await Promise.all([
          prisma.systemLog.count({
            where: {
              type: "api_call",
              source: name,
              createdAt: { gte: todayStart },
            },
          }),
          prisma.systemLog.count({
            where: {
              type: "api_call",
              source: name,
              createdAt: { gte: monthStart },
            },
          }),
        ]);
        return {
          name,
          dailyUsed,
          dailyLimit: limits.daily,
          monthlyUsed,
          monthlyLimit: limits.monthly,
        };
      }),
    );

    return NextResponse.json(quotas, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[admin/quotas]", error);
    return NextResponse.json({ error: GENERIC.INTERNAL_ERROR }, { status: 500 });
  }
}
