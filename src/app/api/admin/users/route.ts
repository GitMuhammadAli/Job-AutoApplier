import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }

    const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
    const take = Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 500);
    const rawOffset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
    const skip = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      take,
      skip,
      include: {
        settings: {
          select: {
            accountStatus: true,
            applicationMode: true,
            fullName: true,
            isOnboarded: true,
            lastVisitedAt: true,
          },
        },
        _count: {
          select: {
            userJobs: true,
            applications: true,
            resumes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sentToday = await prisma.jobApplication.groupBy({
      by: ["userId"],
      where: { status: "SENT", sentAt: { gte: startOfDay } },
      _count: true,
    });
    const sentMap = new Map(sentToday.map((s) => [s.userId, s._count]));

    const result = users.map((u) => ({
      id: u.id,
      name: u.settings?.fullName || u.name || u.email,
      email: u.email,
      status: u.settings?.accountStatus || "unknown",
      mode: u.settings?.applicationMode || "MANUAL",
      isOnboarded: u.settings?.isOnboarded || false,
      sentToday: sentMap.get(u.id) || 0,
      totalJobs: u._count.userJobs,
      totalApplications: u._count.applications,
      resumeCount: u._count.resumes,
      lastActive: u.settings?.lastVisitedAt || null,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/users]", error);
    return NextResponse.json({ error: GENERIC.INTERNAL_ERROR }, { status: 500 });
  }
}
