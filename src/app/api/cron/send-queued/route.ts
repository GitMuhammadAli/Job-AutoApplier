import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, formatCoverLetterHtml } from "@/lib/email/sender";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const readyApplications = await prisma.jobApplication.findMany({
      where: { status: "READY" },
      include: {
        userJob: {
          include: { globalJob: { select: { title: true, company: true } } },
        },
        user: { select: { id: true } },
      },
      take: 20,
    });

    let sent = 0;
    let failed = 0;

    for (const app of readyApplications) {
      await prisma.jobApplication.update({
        where: { id: app.id },
        data: { status: "SENDING" },
      });

      const settings = await prisma.userSettings.findUnique({
        where: { userId: app.userId },
      });

      const html = formatCoverLetterHtml(app.emailBody, settings?.defaultSignature);

      const result = await sendEmail({
        from: `${settings?.fullName || "JobPilot User"} <${app.senderEmail}>`,
        to: app.recipientEmail,
        subject: app.subject,
        html,
      });

      if (result.success) {
        await prisma.$transaction([
          prisma.jobApplication.update({
            where: { id: app.id },
            data: { status: "SENT", sentAt: new Date() },
          }),
          prisma.userJob.update({
            where: { id: app.userJobId },
            data: { stage: "APPLIED" },
          }),
          prisma.activity.create({
            data: {
              userJobId: app.userJobId,
              userId: app.userId,
              type: "APPLICATION_SENT",
              description: `Application sent to ${app.recipientEmail}`,
            },
          }),
        ]);
        sent++;
      } else {
        await prisma.$transaction([
          prisma.jobApplication.update({
            where: { id: app.id },
            data: {
              status: "FAILED",
              errorMessage: result.error || "Unknown error",
              retryCount: { increment: 1 },
            },
          }),
          prisma.activity.create({
            data: {
              userJobId: app.userJobId,
              userId: app.userId,
              type: "APPLICATION_FAILED",
              description: `Send failed: ${result.error}`,
            },
          }),
        ]);
        failed++;
      }
    }

    return NextResponse.json({ success: true, processed: readyApplications.length, sent, failed });
  } catch (error) {
    console.error("Send queued error:", error);
    return NextResponse.json({ error: "Send failed", details: String(error) }, { status: 500 });
  }
}
