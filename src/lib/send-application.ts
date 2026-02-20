import { getTransporterForUser } from "./email";
import { prisma } from "./prisma";
import { canSendNow } from "./send-limiter";
import { checkDuplicate } from "./duplicate-checker";
import { decryptSettingsFields } from "./encryption";

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export async function sendApplication(
  applicationId: string
): Promise<SendResult> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      userJob: { include: { globalJob: true } },
      resume: true,
    },
  });

  if (!application) return { success: false, error: "Application not found" };
  if (!application.recipientEmail)
    return { success: false, error: "No recipient email" };
  if (application.status === "SENT")
    return { success: false, error: "Already sent" };

  const userId = application.userId;

  const rawSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!rawSettings) return { success: false, error: "Settings not found" };
  const settings = decryptSettingsFields(rawSettings);

  // Rate limiting
  const limitCheck = await canSendNow(userId);
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason };
  }

  // Duplicate check
  const dupeCheck = await checkDuplicate(userId, application.userJob.globalJob);
  if (dupeCheck.isDuplicate) {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "DRAFT" },
    });
    return { success: false, error: dupeCheck.reason };
  }

  // Build transporter
  let transporter;
  try {
    transporter = getTransporterForUser(settings);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown SMTP error";
    return { success: false, error: `SMTP error: ${msg}` };
  }

  // Prepare resume attachment
  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }> = [];
  if (application.resume?.fileUrl) {
    try {
      const response = await fetch(application.resume.fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      attachments.push({
        filename:
          application.resume.fileName ||
          `${application.resume.name}.pdf`,
        content: buffer,
        contentType:
          application.resume.fileType === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    } catch {
      console.error(
        `[SendApp] Failed to download resume ${application.resume.id}`
      );
    }
  }

  // Mark as SENDING to prevent double-send
  try {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "SENDING" },
    });

    const result = await transporter.sendMail({
      from: `${settings.fullName || "JobPilot User"} <${settings.smtpUser}>`,
      to: application.recipientEmail,
      subject: application.subject,
      text: application.emailBody,
      html: formatEmailAsHtml(application.emailBody),
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    // Success
    await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "SENT", sentAt: new Date(), retryCount: 0 },
      }),
      prisma.userJob.update({
        where: { id: application.userJobId },
        data: { stage: "APPLIED" },
      }),
      prisma.activity.create({
        data: {
          userId,
          userJobId: application.userJobId,
          type: "APPLICATION_SENT",
          description: `Email sent to ${application.recipientEmail} via ${settings.emailProvider || "smtp"}`,
        },
      }),
    ]);

    return { success: true, messageId: result.messageId };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown send error";
    const currentRetry = (application.retryCount || 0) + 1;

    if (currentRetry < 3) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "READY", retryCount: currentRetry },
      });
      console.error(
        `[SendApp] Attempt ${currentRetry}/3 failed: ${errorMsg}`
      );
    } else {
      await prisma.$transaction([
        prisma.jobApplication.update({
          where: { id: applicationId },
          data: {
            status: "FAILED",
            retryCount: currentRetry,
            errorMessage: errorMsg,
          },
        }),
        prisma.activity.create({
          data: {
            userId,
            userJobId: application.userJobId,
            type: "APPLICATION_FAILED",
            description: `Failed after 3 attempts: ${errorMsg}`,
          },
        }),
      ]);
    }

    return { success: false, error: errorMsg };
  }
}

function formatEmailAsHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" style="color: #2563eb;">$1</a>'
    );
}
