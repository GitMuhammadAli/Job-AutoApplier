import { getTransporterForUser, formatCoverLetterHtml } from "./email";
import { prisma } from "./prisma";
import { canSendNow } from "./send-limiter";
import { checkDuplicate } from "./duplicate-checker";
import { decryptSettingsFields, hasDecryptionFailure } from "./encryption";
import { classifyError } from "./email-errors";
import { ensureTailoredResume } from "./resume/auto-attach";
import { renderPdfFromHtml, ChromiumNotInstalledError } from "./resume/pdf";

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export async function sendApplication(
  applicationId: string,
  // mode: "primary" sends the original application (subject + emailBody fields).
  // mode: "followup" sends the AI-generated follow-up draft (followUpSubject +
  // followUpBody fields) without re-sending the original. Used by the user
  // when they review a follow-up draft on /applications and click Send.
  mode: "primary" | "followup" = "primary",
): Promise<SendResult> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      userJob: { include: { globalJob: true } },
      resume: true,
    },
  });

  if (!application) return { success: false, error: "That application draft isn't around any more." };
  if (!application.recipientEmail)
    return {
      success: false,
      error: "This draft has no recipient email yet. Add one before sending.",
    };
  if (mode === "primary" && application.status === "SENT")
    return { success: false, error: "This one's already been sent." };
  if (mode === "followup") {
    if (!application.followUpSubject || !application.followUpBody) {
      return { success: false, error: "No follow-up draft on this application yet." };
    }
    if (application.followUpStatus === "SENT") {
      return { success: false, error: "This follow-up has already been sent." };
    }
  }

  const userId = application.userId;

  const rawSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!rawSettings)
    return { success: false, error: "Set up your profile first — head to Settings." };
  const settings = decryptSettingsFields(rawSettings);

  if (hasDecryptionFailure(settings as Record<string, unknown>, "smtpPass", "smtpUser", "applicationEmail")) {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: "FAILED",
        errorMessage: "Couldn't read your SMTP credentials. Open Settings → Email and save again to fix it.",
      },
    });
    return {
      success: false,
      error: "Couldn't read your email credentials. Open Settings → Email and save again to fix it.",
    };
  }

  // Rate limiting
  const limitCheck = await canSendNow(userId);
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason };
  }

  // Suppression check — has this recipient hard-bounced, complained, or
  // unsubscribed? Don't send. Reuses the EmailSuppression table added in
  // this session — see prisma/migrations/…_add_email_suppression.
  const suppressed = await prisma.emailSuppression.findUnique({
    where: { userId_email: { userId, email: application.recipientEmail.toLowerCase() } },
    select: { reason: true, suppressedAt: true, expiresAt: true },
  });
  if (suppressed && (!suppressed.expiresAt || suppressed.expiresAt > new Date())) {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: "FAILED",
        errorMessage: `Recipient is on your suppression list (${suppressed.reason.toLowerCase().replace(/_/g, " ")}). Remove them in Settings before retrying.`,
      },
    });
    return {
      success: false,
      error: `That address is suppressed (${suppressed.reason.toLowerCase().replace(/_/g, " ")}). Remove it from the suppression list to send.`,
    };
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

  // ── 1. Try JD-tailored generation first (Phase 3) ─────────────────────
  // If the user has a structured ResumeProfile, ensureTailoredResume will
  // either reuse an existing ResumeGeneration or produce a fresh one from
  // the globalJob's description. Best-effort: any failure here falls
  // through to the uploaded-PDF path below.
  try {
    const tailored = await ensureTailoredResume(applicationId);
    if (tailored) {
      const generation = await prisma.resumeGeneration.findUnique({
        where: { id: tailored.generationId },
        select: {
          htmlSnapshot: true,
          templateId: true,
          user: { select: { name: true, settings: { select: { fullName: true } } } },
        },
      });
      if (generation?.htmlSnapshot) {
        const pdf = await renderPdfFromHtml(generation.htmlSnapshot);
        const namePart = (generation.user.settings?.fullName || generation.user.name || "resume").replace(/[^A-Za-z0-9_-]+/g, "_");
        attachments.push({
          filename: `${namePart}_${generation.templateId}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        });
        resumeAttached = true;
      }
    }
  } catch (err) {
    if (err instanceof ChromiumNotInstalledError) {
      console.warn("[SendApp] Skipping tailored resume — Chromium not installed. Falling back to uploaded PDF.");
    } else {
      console.warn(
        `[SendApp] Tailored resume failed for ${applicationId}, falling back to uploaded PDF:`,
        err instanceof Error ? err.message : err,
      );
    }
    // proceed to fallback
  }

  // ── 2. Fallback: existing uploaded Resume PDF ─────────────────────────
  if (!resumeAttached && application.resume?.fileUrl) {
    // Retry policy: 3 attempts × 5s each, with exponential-ish backoff.
    // Previously this was a single fetch with a 5s timeout — any transient
    // Vercel Blob 503 or slow CDN response would fail the whole send and
    // the user would see "Couldn't download your resume" even when a
    // 1-second retry would have succeeded. Cron will retry the whole send
    // next cycle, but this saves a 5-minute round-trip on flake.
    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !resumeAttached; attempt++) {
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
          break;
        }
        lastError = `HTTP ${response.status}`;
        // 4xx is permanent (file deleted, ACL changed). Don't retry.
        if (response.status >= 400 && response.status < 500) {
          console.error(
            `[SendApp] Resume download permanent failure HTTP ${response.status} for ${application.resume.id} — not retrying`,
          );
          break;
        }
        console.warn(
          `[SendApp] Resume download attempt ${attempt}/${MAX_ATTEMPTS} got HTTP ${response.status} for ${application.resume.id}`,
        );
      } catch (err) {
        lastError = err;
        console.warn(
          `[SendApp] Resume download attempt ${attempt}/${MAX_ATTEMPTS} threw for ${application.resume.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
      if (!resumeAttached && attempt < MAX_ATTEMPTS) {
        // 500ms, 1500ms backoff. Keeps the total wall-clock under the
        // surrounding send timeout while spacing out enough to clear
        // transient blips.
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    if (!resumeAttached) {
      console.error(
        `[SendApp] Resume download failed after ${MAX_ATTEMPTS} attempts for ${application.resume.id}:`,
        lastError,
      );
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "READY", errorMessage: "Resume download failed — will retry" },
      });
      return {
        success: false,
        error: "Couldn't download your resume. We'll retry on the next cron run.",
      };
    }
  } else {
    resumeAttached = true;
  }

  // Atomic claim: only one caller can transition DRAFT/READY → SENDING for
  // primary mode. For follow-up mode, the application is already SENT; we
  // claim by checking followUpStatus="DRAFT" and flipping to "SENDING" so
  // two cron passes don't double-send the same follow-up.
  try {
    if (mode === "followup") {
      const claimed = await prisma.jobApplication.updateMany({
        where: { id: applicationId, followUpStatus: "DRAFT" },
        data: { followUpStatus: "SENDING" },
      });
      if (claimed.count === 0) {
        return { success: false, error: "Already sending or sent — nothing to do." };
      }
    } else {
      const claimed = await prisma.jobApplication.updateMany({
        where: {
          id: applicationId,
          status: { in: ["DRAFT", "READY"] },
        },
        data: { status: "SENDING" },
      });
      if (claimed.count === 0) {
        return { success: false, error: "Already sending or sent — nothing to do." };
      }
    }

    let cleanSubject: string;
    let cleanBody: string;
    try {
      cleanSubject = cleanJsonField(
        mode === "followup" ? (application.followUpSubject ?? "") : application.subject,
        "subject",
      );
      cleanBody = cleanJsonField(
        mode === "followup" ? (application.followUpBody ?? "") : application.emailBody,
        "body",
      );
    } catch (parseErr) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: "FAILED",
          errorMessage: "We couldn't parse the email subject/body. Regenerate the draft.",
        },
      });
      console.error(`[SendApp] cleanJsonField threw for ${applicationId}:`, parseErr);
      return {
        success: false,
        error: "We couldn't parse the email subject/body. Regenerate the draft.",
      };
    }

    if (!cleanSubject.trim()) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "DRAFT", errorMessage: "Empty subject line — won't send." },
      });
      return { success: false, error: "Subject line is empty — add one before sending." };
    }
    if (!cleanBody.trim()) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "DRAFT", errorMessage: "Empty email body — won't send." },
      });
      return { success: false, error: "Email body is empty — write something before sending." };
    }

    const senderAddr = settings.applicationEmail || settings.smtpUser;
    if (!senderAddr) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: "FAILED",
          errorMessage: "No sender email configured. Open Settings → Email to set one up.",
        },
      });
      return {
        success: false,
        error: "No sender email configured. Open Settings → Email to set one up.",
      };
    }

    // Threading — when sending a follow-up, set In-Reply-To/References to the
    // original send's Message-ID so the reply lands in the same Gmail thread.
    // Falls back to a fresh thread when the original messageId wasn't captured.
    const threadingHeaders: Record<string, string> = {};
    if (mode === "followup" && application.messageId) {
      threadingHeaders["In-Reply-To"] = application.messageId;
      threadingHeaders["References"] = application.messageId;
    }

    // List-Unsubscribe — RFC 8058 one-click + mailto fallback. Required by
    // Gmail/Yahoo bulk-sender rules and dramatically lowers inbox-placement
    // risk. Unsub link encodes the application id so the receiver endpoint
    // can identify which contact to suppress without exposing the user-id.
    const unsubBase = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const unsubUrl = unsubBase
      ? `${unsubBase.replace(/\/$/, "")}/api/email/unsubscribe?app=${applicationId}`
      : null;
    const listHeaders: Record<string, string> = {};
    if (unsubUrl) {
      listHeaders["List-Unsubscribe"] = `<${unsubUrl}>, <mailto:unsubscribe+${applicationId}@${(senderAddr.split("@")[1] || "jobpilot.app")}>`;
      listHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
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
      headers: { ...threadingHeaders, ...listHeaders },
    });

    // Success — primary mode flips status to SENT; follow-up mode keeps
    // the primary status (already SENT) and just flips followUpStatus +
    // bumps the count. Stage doesn't move on follow-up — it should stay
    // in APPLIED so the cron knows whether further follow-ups apply.
    await prisma.$transaction(
      mode === "followup"
        ? [
            prisma.jobApplication.update({
              where: { id: applicationId },
              data: {
                followUpStatus: "SENT",
              },
            }),
            prisma.userJob.update({
              where: { id: application.userJobId },
              data: {
                followUpCount: { increment: 1 },
                lastFollowUpAt: new Date(),
              },
            }),
            prisma.activity.create({
              data: {
                userId,
                userJobId: application.userJobId,
                type: "FOLLOW_UP_SENT",
                description: `Follow-up sent via ${settings.emailProvider || "smtp"}`,
              },
            }),
          ]
        : [
      prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          retryCount: 0,
          messageId: result.messageId ?? null,
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
    ],
    );

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
      return {
        success: false,
        error: "Your email password didn't check out. Open Settings → Email and update your app password.",
      };
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

