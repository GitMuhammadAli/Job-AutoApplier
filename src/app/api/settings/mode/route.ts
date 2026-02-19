import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { applicationMode: true, accountStatus: true },
    });
    return NextResponse.json({
      mode: settings?.applicationMode || "MANUAL",
      status: settings?.accountStatus || "active",
    });
  } catch {
    return NextResponse.json({ mode: "MANUAL", status: "active" });
  }
}
