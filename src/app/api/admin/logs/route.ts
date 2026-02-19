import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const skip = parseInt(searchParams.get("skip") || "0");
  const take = Math.min(parseInt(searchParams.get("take") || "50"), 100);

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (source) where.source = source;

  const logs = await prisma.systemLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return NextResponse.json(logs);
}
