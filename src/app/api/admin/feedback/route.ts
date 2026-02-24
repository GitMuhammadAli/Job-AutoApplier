import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (adminCheck) return adminCheck;

  const status = req.nextUrl.searchParams.get("status");
  const type = req.nextUrl.searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (type && type !== "all") where.type = type;

  const feedback = await prisma.userFeedback.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ feedback });
}

export async function PATCH(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (adminCheck) return adminCheck;

  const { id, status, adminNote } = await req.json();
  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  const data: Record<string, unknown> = { status };
  if (adminNote !== undefined) data.adminNote = adminNote || null;

  await prisma.userFeedback.update({ where: { id }, data });

  return NextResponse.json({ success: true });
}
