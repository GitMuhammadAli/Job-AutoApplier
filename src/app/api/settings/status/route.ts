import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERIC, SETTINGS } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const { accountStatus } = (await req.json()) as {
      accountStatus: string;
    };

    if (!["active", "paused"].includes(accountStatus)) {
      return NextResponse.json(
        { error: GENERIC.INVALID_STATUS },
        { status: 400 }
      );
    }

    await prisma.userSettings.update({
      where: { userId },
      data: { accountStatus },
    });

    return NextResponse.json({ success: true, accountStatus });
  } catch (error) {
    if (error instanceof Error && error.message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }
    console.error("[SettingsStatus]", error);
    return NextResponse.json(
      { error: SETTINGS.FAILED_UPDATE },
      { status: 500 }
    );
  }
}
