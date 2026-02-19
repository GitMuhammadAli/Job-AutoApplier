import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const { accountStatus } = (await req.json()) as {
      accountStatus: string;
    };

    if (!["active", "paused"].includes(accountStatus)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    await prisma.userSettings.update({
      where: { userId },
      data: { accountStatus },
    });

    return NextResponse.json({ success: true, accountStatus });
  } catch (error) {
    console.error("[SettingsStatus]", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
