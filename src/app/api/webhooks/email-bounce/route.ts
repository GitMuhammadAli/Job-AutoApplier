import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSystemTransporter } from "@/lib/email";
import { bounceAlertTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

interface BrevoBounceEvent {
  event?: string;
  email?: string;
  reason?: string;
  "message-id"?: string;
  [key: string]: unknown;
}

const BOUNCE_EVENTS = new Set([
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "spam",
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BrevoBounceEvent;
    const eventType = body.event;
    const email = body.email;
    const messageId = body["message-id"];
    const reason = body.reason || `Bounce received (${eventType || "unknown"})`;

    if (!email) {
      return NextResponse.json({ received: true });
    }

    if (eventType && !BOUNCE_EVENTS.has(eventType)) {
      return NextResponse.json({ received: true });
    }

    const application = await prisma.jobApplication.findFirst({
      where: { recipientEmail: email, status: "SENT" },
      orderBy: { sentAt: "desc" },
      include: {
        userJob: { include: { globalJob: true } },
      },
    });

    if (application) {
      // Mark application as BOUNCED
      await prisma.jobApplication.update({
        where: { id: application.id },
        data: { status: "BOUNCED", errorMessage: reason },
      });

      // Clear bad email from GlobalJob
      await prisma.globalJob.update({
        where: { id: application.userJob.globalJobId },
        data: { companyEmail: null },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId: application.userId,
          userJobId: application.userJobId,
          type: "APPLICATION_BOUNCED",
          description: `Email to ${email} bounced (${eventType || "unknown"})`,
        },
      });

      // Send bounce notification to user
      const settings = await prisma.userSettings.findUnique({
        where: { userId: application.userId },
      });
      if (settings?.emailNotifications) {
        try {
          const template = bounceAlertTemplate(
            settings.fullName || "there",
            email,
            reason
          );

          const transporter = getSystemTransporter();
          const notifEmail =
            settings.notificationEmail ||
            (
              await prisma.user.findUnique({
                where: { id: application.userId },
                select: { email: true },
              })
            )?.email;

          if (notifEmail) {
            await transporter.sendMail({
              from: `JobPilot <${process.env.NOTIFICATION_EMAIL || "noreply@jobpilot.app"}>`,
              to: notifEmail,
              subject: template.subject,
              html: template.html,
            });
          }
        } catch {
          // Notification failure is not critical
        }
      }
    }

    await prisma.systemLog.create({
      data: {
        type: "bounce",
        source: "webhook",
        message: `Bounce: ${email} (${eventType || "unknown"})`,
        metadata: { email, event: eventType, messageId },
      },
    });

    return NextResponse.json({ processed: true });
  } catch (error) {
    console.error("Email bounce webhook error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
