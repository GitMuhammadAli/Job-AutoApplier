import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERIC, SETTINGS } from "@/lib/messages";
import { captureError } from "@/lib/observability/capture";
import { parseBody } from "@/lib/validation/parse-body";

export const dynamic = "force-dynamic";

const PatchStatusBody = z.object({
  accountStatus: z.enum(["active", "paused"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
    const parsed = await parseBody(req, PatchStatusBody);
    if (!parsed.ok) return parsed.response;
    const { accountStatus } = parsed.data;

    await prisma.userSettings.update({
      where: { userId },
      data: { accountStatus },
    });

    return NextResponse.json({ success: true, accountStatus });
  } catch (error) {
    if (error instanceof Error && error.message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }
    await captureError(error, { route: "/api/settings/status" });
    return NextResponse.json(
      { error: SETTINGS.FAILED_UPDATE },
      { status: 500 }
    );
  }
}
