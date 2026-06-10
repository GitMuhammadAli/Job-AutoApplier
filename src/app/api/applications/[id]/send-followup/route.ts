/**
 * POST /api/applications/[id]/send-followup
 *
 * Sends the AI-generated follow-up draft attached to an application.
 * Mirrors the primary /send route but passes mode="followup" so
 * sendApplication reads followUpSubject/followUpBody fields, applies the
 * follow-up status transitions, and increments the user-job's
 * followUpCount.
 *
 * Pre-conditions enforced by sendApplication:
 *   - followUpStatus must be "DRAFT" (atomic claim flips to "SENDING")
 *   - Application must already be SENT (follow-ups only chase live apps)
 *   - User settings + transporter creds same as primary send
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth";
import { sendApplication } from "@/lib/send-application";
import { prisma } from "@/lib/prisma";
import { GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const __auth = await requireAuthUserId();
    if (__auth.response) return __auth.response;
    const userId = __auth.userId;
    const { id } = await params;

    const application = await prisma.jobApplication.findFirst({
      where: { id, userId },
      select: { id: true, status: true, followUpStatus: true, followUpSubject: true },
    });
    if (!application) {
      return NextResponse.json({ error: GENERIC.NOT_FOUND }, { status: 404 });
    }
    if (application.status !== "SENT") {
      return NextResponse.json(
        { error: "Send the original application first — follow-ups only chase sent emails." },
        { status: 400 },
      );
    }
    if (!application.followUpSubject) {
      return NextResponse.json(
        { error: "No follow-up draft on this application yet." },
        { status: 400 },
      );
    }
    if (application.followUpStatus === "SENT") {
      return NextResponse.json(
        { error: "This follow-up has already been sent." },
        { status: 400 },
      );
    }

    const result = await sendApplication(id, "followup");

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }
    console.error("[SendFollowUpRoute] Error:", error);
    return NextResponse.json(
      { error: GENERIC.INTERNAL_SERVER_ERROR },
      { status: 500 },
    );
  }
}
