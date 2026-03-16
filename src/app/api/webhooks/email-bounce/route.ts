import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSystemTransporter } from "@/lib/email";
import { bounceAlertTemplate } from "@/lib/email-templates";
import { decryptSettingsFields } from "@/lib/encryption";
import { createHmac, timingSafeEqual } from "crypto";

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

// Only these events indicate permanently invalid addresses
const HARD_BOUNCE_EVENTS = new Set([
  "hard_bounce",
  "blocked",
  "spam",
]);

function verifyBrevoSignature(req: NextRequest, rawBody: string): boolean {
  const webhookSecret = process.env.BREVO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[BounceWebhook] BREVO_WEBHOOK_SECRET not set — rejecting unverified webhook");
    return false;
  }

  const signature =
    req.headers.get("x-brevo-signature") || req.headers.get("x-sib-signature");
  if (!signature) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  const sigBuf = Buffer.from(signature.toLowerCase());
  const expBuf = Buffer.from(expected.toLowerCase());
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyBrevoSignature(req, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as BrevoBounceEvent;
    const eventType = body.event;
    const email = body.email;
    const messageId = body["message-id"];
    const reason = body.reason || `Bounce received (${eventType || "unknown"})`;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
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
      const isHardBounce = !eventType || HARD_BOUNCE_EVENTS.has(eventType);

      // Soft bounce: re-queue for retry. Hard bounce: mark permanently failed.
      if (isHardBounce) {
        await prisma.jobApplication.update({
          where: { id: application.id },
          data: { status: "BOUNCED", errorMessage: reason },
        });

        // Only clear company email on hard bounces (permanent failures)
        await prisma.globalJob.update({
          where: { id: application.userJob.globalJobId },
          data: { companyEmail: null, emailConfidence: null, emailSource: null },
        });
      } else {
        // Soft bounce — re-queue if under retry limit, otherwise fail
        const retries = (application.retryCount || 0) + 1;
        if (retries < 3) {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { status: "READY", retryCount: retries, errorMessage: `Soft bounce (attempt ${retries}/3): ${reason}` },
          });
        } else {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { status: "FAILED", retryCount: retries, errorMessage: `Soft bounce failed after 3 attempts: ${reason}` },
          });
        }
      }

      // Log activity
      await prisma.activity.create({
        data: {
          userId: application.userId,
          userJobId: application.userJobId,
          type: isHardBounce ? "APPLICATION_BOUNCED" : "APPLICATION_FAILED",
          description: `Email to ${email} ${isHardBounce ? "bounced" : "soft-bounced"} (${eventType || "unknown"})`,
        },
      });

      // Send bounce notification to user (only for hard bounces)
      const settings = decryptSettingsFields(
        await prisma.userSettings.findUnique({
          where: { userId: application.userId },
        }),
      );
      if (isHardBounce && settings?.emailNotifications) {
        try {
          const template = bounceAlertTemplate(
            settings.fullName || "there",
            email,
            reason,
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
              from: `JobPilot <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "notifications@jobpilot.app"}>`,
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
    console.error("[BounceWebhook] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
