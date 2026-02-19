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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not authenticated" || message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[settings/mode] Error:", error);
    return NextResponse.json({ error: "Failed to load mode" }, { status: 500 });
  }
}
