import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { sendApplication } from "@/lib/send-application";
import { checkReadiness } from "@/lib/readiness-checker";
import { prisma } from "@/lib/prisma";

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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (application.status === "SENT") {
      return NextResponse.json(
        { error: "Already sent" },
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
          error: `Not ready to send. Missing: ${missing.join(", ")}`,
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
    console.error("[SendRoute] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
