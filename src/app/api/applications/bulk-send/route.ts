import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { sendApplication } from "@/lib/send-application";
import { checkReadiness } from "@/lib/readiness-checker";
import { prisma } from "@/lib/prisma";
import { TIMEOUTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
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

    // Cap at 3 per request to stay within 10s Vercel limit
    const ids = applicationIds.slice(0, 3);

    const applications = await prisma.jobApplication.findMany({
      where: {
        id: { in: ids },
        userId,
        status: { in: ["DRAFT", "READY"] },
      },
      include: {
        userJob: {
          include: {
            globalJob: {
              select: { emailConfidence: true },
            },
          },
        },
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

    // Quality filter: only send to verified emails (confidence >= 80) with a recipient
    const qualified: typeof applications = [];
    let skippedNoEmail = 0;
    let skippedLowConfidence = 0;

    for (const app of applications) {
      if (!app.recipientEmail) {
        skippedNoEmail++;
        continue;
      }
      const confidence = app.userJob?.globalJob?.emailConfidence ?? 0;
      if (confidence < 80) {
        skippedLowConfidence++;
        continue;
      }
      qualified.push(app);
    }

    // Dedup by recipient email — keep only the first application per address
    const seenEmails = new Set<string>();
    const deduped: typeof qualified = [];
    let duplicatesRemoved = 0;

    for (const app of qualified) {
      const email = app.recipientEmail!.toLowerCase();
      if (seenEmails.has(email)) {
        duplicatesRemoved++;
        continue;
      }
      seenEmails.add(email);
      deduped.push(app);
    }

    const results: {
      id: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (let i = 0; i < deduped.length; i++) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) {
        break;
      }

      const app = deduped[i];
      const result = await sendApplication(app.id);
      results.push({
        id: app.id,
        success: result.success,
        error: result.error,
      });

      if (!result.success && result.error?.includes("limit")) {
        break;
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      sent,
      failed,
      skippedNoEmail,
      skippedLowConfidence,
      duplicatesRemoved,
      results,
    });
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
