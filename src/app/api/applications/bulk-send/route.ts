import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { sendApplication } from "@/lib/send-application";
import { checkReadiness } from "@/lib/readiness-checker";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const { applicationIds } = (await req.json()) as {
      applicationIds: string[];
    };

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json(
        { error: "No applications selected" },
        { status: 400 }
      );
    }

    const ids = applicationIds.slice(0, 10);

    const applications = await prisma.jobApplication.findMany({
      where: {
        id: { in: ids },
        userId,
        status: { in: ["DRAFT", "READY"] },
      },
    });

    if (applications.length === 0) {
      return NextResponse.json(
        { error: "No sendable applications found" },
        { status: 400 }
      );
    }

    const readiness = await checkReadiness(userId);
    if (!readiness.ready) {
      return NextResponse.json(
        { error: "Profile not ready for sending" },
        { status: 400 }
      );
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    const results: {
      id: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      const result = await sendApplication(app.id);
      results.push({
        id: app.id,
        success: result.success,
        error: result.error,
      });

      if (!result.success && result.error?.includes("limit")) {
        break;
      }

      // Brief delay between sends (capped to prevent timeout)
      if (settings && i < applications.length - 1) {
        const delay = Math.min(settings.sendDelaySeconds * 1000, 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ sent, failed, results });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[BulkSend] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
