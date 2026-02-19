import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
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
}
