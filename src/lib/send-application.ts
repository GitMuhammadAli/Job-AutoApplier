import { getTransporterForUser, formatCoverLetterHtml } from "./email";
import { prisma } from "./prisma";
import { canSendNow } from "./send-limiter";
import { checkDuplicate } from "./duplicate-checker";
import { decryptSettingsFields } from "./encryption";
import { classifyError } from "./email-errors";

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
  let resumeAttached = false;
  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }> = [];
  if (application.resume?.fileUrl) {
    try {
      const response = await fetch(application.resume.fileUrl, {
        signal: AbortSignal.timeout(8000), // C5: keep under 10s Hobby limit
      });
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const rawName = application.resume.fileName || application.resume.name;
        const fileName = rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`;
        attachments.push({
          filename: fileName,
          content: buffer,
          contentType: "application/pdf",
        });
        resumeAttached = true;
      } else {
        console.error(`[SendApp] Resume download HTTP ${response.status} for ${application.resume.id}`);
      }
    } catch (err) {
      console.error(`[SendApp] Failed to download resume ${application.resume.id}:`, err);
    }
  } else {
    resumeAttached = true; // No resume to attach — not a failure
  }

  // Atomic claim: only one caller can transition DRAFT/READY → SENDING
  try {
    const claimed = await prisma.jobApplication.updateMany({
      where: {
        id: applicationId,
        status: { in: ["DRAFT", "READY"] },
      },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) {
      return { success: false, error: "Already sending or sent" };
    }

    const cleanSubject = cleanJsonField(application.subject, "subject");
    const cleanBody = cleanJsonField(application.emailBody, "body");

    // H1+H2: Validate email fields before sending
    if (!cleanSubject.trim()) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "DRAFT", errorMessage: "Empty subject line" },
      });
      return { success: false, error: "Empty subject line — cannot send" };
    }
    if (!cleanBody.trim()) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "DRAFT", errorMessage: "Empty email body" },
      });
      return { success: false, error: "Empty email body — cannot send" };
    }

    const result = await transporter.sendMail({
      from: `${settings.fullName || "JobPilot User"} <${settings.applicationEmail || settings.smtpUser}>`,
      to: application.recipientEmail,
      subject: cleanSubject,
      text: cleanBody,
      html: formatCoverLetterHtml(cleanBody),
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    // Success — C4: track resume attachment failure as warning
    await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          retryCount: 0,
          ...(resumeAttached ? {} : { errorMessage: "Warning: Resume failed to attach — email sent without it" }),
        },
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
    const classified = classifyError(err);

    if (classified.type === "permanent") {
      await prisma.$transaction([
        prisma.jobApplication.update({
          where: { id: applicationId },
          data: {
            status: "BOUNCED",
            retryCount: (application.retryCount || 0) + 1,
            errorMessage: classified.message,
          },
        }),
        prisma.activity.create({
          data: {
            userId,
            userJobId: application.userJobId,
            type: "APPLICATION_BOUNCED",
            description: `Email to ${application.recipientEmail} rejected: ${classified.message}`,
          },
        }),
      ]);

      await prisma.globalJob.update({
        where: { id: application.userJob.globalJobId },
        data: { companyEmail: null, emailConfidence: null, emailSource: null },
      }).catch((err) => console.error("[SendApp] Failed to clear bounced email from GlobalJob:", err));

      console.error(
        `[SendApp] Permanent rejection for ${application.recipientEmail}: ${classified.message}`
      );
      return { success: false, error: classified.message };
    }

    if (classified.type === "auth") {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: "FAILED",
          retryCount: (application.retryCount || 0) + 1,
          errorMessage: `Auth error: ${classified.message}`,
        },
      });
      console.error(`[SendApp] Auth failure: ${classified.message}`);
      return { success: false, error: `SMTP auth failed — check your app password in Settings` };
    }

    // Rate limit: don't count as retry, just re-queue for later
    if (classified.type === "rate_limit") {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "READY" },
      });
      console.warn(`[SendApp] Rate limited: ${classified.message}`);
      return { success: false, error: `Rate limited by provider — will retry later` };
    }

    // Transient / network errors: retry up to 3 times
    const currentRetry = (application.retryCount || 0) + 1;

    if (currentRetry < 3) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "READY", retryCount: currentRetry },
      });
      console.error(
        `[SendApp] ${classified.type} error, attempt ${currentRetry}/3: ${classified.message}`
      );
    } else {
      await prisma.$transaction([
        prisma.jobApplication.update({
          where: { id: applicationId },
          data: {
            status: "FAILED",
            retryCount: currentRetry,
            errorMessage: classified.message,
          },
        }),
        prisma.activity.create({
          data: {
            userId,
            userJobId: application.userJobId,
            type: "APPLICATION_FAILED",
            description: `Failed after 3 attempts (${classified.type}): ${classified.message}`,
          },
        }),
      ]);
    }

    return { success: false, error: classified.message };
  }
}

function cleanJsonField(value: string, field: "subject" | "body"): string {
  if (!value || !value.trimStart().startsWith("{")) return value;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && typeof parsed[field] === "string") {
      return parsed[field];
    }
  } catch { /* not JSON */ }
  return value;
}

