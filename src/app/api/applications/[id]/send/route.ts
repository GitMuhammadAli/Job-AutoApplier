import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { sendApplication } from "@/lib/send-application";
import { checkReadiness } from "@/lib/readiness-checker";
import { prisma } from "@/lib/prisma";
import { APPLICATIONS, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const { id } = await params;

    const application = await prisma.jobApplication.findFirst({
      where: { id, userId },
    });
    if (!application) {
      return NextResponse.json({ error: GENERIC.NOT_FOUND }, { status: 404 });
    }
    if (application.status === "SENT") {
      return NextResponse.json(
        { error: APPLICATIONS.ALREADY_SENT },
        { status: 400 }
      );
    }

    const readiness = await checkReadiness(userId);
    if (!readiness.ready) {
      const missing = readiness.checks
        .filter((c) => !c.passed)
        .map((c) => c.name);
      return NextResponse.json(
        {
          error: APPLICATIONS.NOT_READY_MISSING(missing.join(", ")),
        },
        { status: 400 }
      );
    }

    const result = await sendApplication(id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }
    console.error("[SendRoute] Error:", error);
    return NextResponse.json(
      { error: GENERIC.INTERNAL_SERVER_ERROR },
      { status: 500 }
    );
  }
}
