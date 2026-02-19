import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    include: {
      settings: {
        select: {
          applicationMode: true,
          accountStatus: true,
          lastVisitedAt: true,
        },
      },
      _count: {
        select: {
          applications: {
            where: { status: "SENT", sentAt: { gte: todayStart } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      mode: u.settings?.applicationMode ?? "SEMI_AUTO",
      sentToday: u._count.applications,
      lastActive: u.settings?.lastVisitedAt ?? u.updatedAt,
      status: u.settings?.accountStatus ?? "active",
    }))
  );
}
