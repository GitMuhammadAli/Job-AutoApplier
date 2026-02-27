import { getTransporterForUser, formatCoverLetterHtml } from "./email";
import { prisma } from "./prisma";
import { canSendNow } from "./send-limiter";
import { checkDuplicate } from "./duplicate-checker";
import { decryptSettingsFields, hasDecryptionFailure } from "./encryption";
import { classifyError } from "./email-errors";
import { verifyRecipient } from "./email-verifier";

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

  if (hasDecryptionFailure(settings as Record<string, unknown>, "smtpPass", "smtpUser", "applicationEmail")) {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "FAILED", errorMessage: "SMTP credentials could not be decrypted — re-save your settings" },
    });
    return { success: false, error: "SMTP credentials decryption failed — re-save settings" };
  }

  // Rate limiting
  const limitCheck = await canSendNow(userId);
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason };
  }

  // Duplicate check
  const dupeCheck = await checkDuplicate(userId, application.userJob.globalJob);
  if (dupeCheck.isDuplicate) {
    // C6: Only revert if currently READY (preserve DRAFT state, log the reversion)
    if (application.status === "READY") {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "DRAFT", errorMessage: `Duplicate detected: ${dupeCheck.reason}` },
      });
    }
    console.warn(`[SendApp] Duplicate detected for ${applicationId}: ${dupeCheck.reason}`);
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
        signal: AbortSignal.timeout(5000),
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
    if (!resumeAttached) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "READY", errorMessage: "Resume download failed — will retry" },
      });
      return { success: false, error: "Resume download failed — will retry on next cron run" };
    }
  } else {
    resumeAttached = true;
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

    let cleanSubject: string;
    let cleanBody: string;
    try {
      cleanSubject = cleanJsonField(application.subject, "subject");
      cleanBody = cleanJsonField(application.emailBody, "body");
    } catch (parseErr) {
      // C2: If field cleaning throws, revert SENDING → FAILED (don't leave stuck)
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "FAILED", errorMessage: "Failed to parse email fields" },
      });
      console.error(`[SendApp] cleanJsonField threw for ${applicationId}:`, parseErr);
      return { success: false, error: "Failed to parse email fields" };
    }

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

    const senderAddr = settings.applicationEmail || settings.smtpUser;
    if (!senderAddr) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "FAILED", errorMessage: "No sender email configured — check SMTP settings" },
      });
      return { success: false, error: "No sender email configured" };
    }

    // Pre-send recipient verification via RCPT TO — catches invalid
    // mailboxes before wasting a real send and hurting sender reputation
    try {
      const rcptResult = await verifyRecipient(application.recipientEmail);
      if (!rcptResult.exists) {
        const reason = rcptResult.smtpCode
          ? `Recipient rejected (SMTP ${rcptResult.smtpCode}): ${rcptResult.message}`
          : `Recipient verification failed: ${rcptResult.message || "mailbox does not exist"}`;

        // Timeout/connection errors = inconclusive, allow the send to proceed
        const inconclusive = rcptResult.message === "timeout"
          || rcptResult.message === "socket timeout"
          || rcptResult.message === "connection error";

        if (!inconclusive) {
          await prisma.$transaction([
            prisma.jobApplication.update({
              where: { id: applicationId },
              data: { status: "BOUNCED", errorMessage: reason, scheduledSendAt: null },
            }),
            prisma.activity.create({
              data: {
                userId,
                userJobId: application.userJobId,
                type: "APPLICATION_BOUNCED",
                description: `Pre-send check: ${reason}`,
              },
            }),
          ]);

          await prisma.globalJob.update({
            where: { id: application.userJob.globalJobId },
            data: { companyEmail: null, emailConfidence: null, emailSource: null },
          }).catch((err) => console.error("[SendApp] Failed to clear invalid email from GlobalJob:", err));

          console.warn(`[SendApp] Pre-send RCPT TO rejected ${application.recipientEmail}: ${reason}`);
          return { success: false, error: reason };
        }
        console.log(`[SendApp] RCPT TO inconclusive for ${application.recipientEmail} (${rcptResult.message}), proceeding with send`);
      }
    } catch (verifyErr) {
      // Verification itself failed — don't block the send
      console.warn("[SendApp] RCPT TO verification error, proceeding:", verifyErr);
    }

    const result = await transporter.sendMail({
      from: `${settings.fullName || "JobPilot User"} <${senderAddr}>`,
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
          // H6: Clear scheduled time on success so it doesn't get re-sent
          scheduledSendAt: null,
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
          // M11: Avoid logging full recipient email (PII) — mask it
          description: `Email sent via ${settings.emailProvider || "smtp"}`,
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
            scheduledSendAt: null,
          },
        }),
        prisma.activity.create({
          data: {
            userId,
            userJobId: application.userJobId,
            type: "APPLICATION_BOUNCED",
            description: `Email rejected: ${classified.message}`,
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
          scheduledSendAt: null,
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
            scheduledSendAt: null,
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
  } catch { /* not valid JSON */ }
  // M1: If it looks like a JSON fragment but failed to parse, strip it
  // rather than sending raw {"subject": ... as an email
  const stripped = value.replace(/^\s*\{[\s\S]*$/, "").trim();
  return stripped || value;
}

