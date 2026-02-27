import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { classifyError } from "@/lib/email-errors";

export interface EmailSettings {
  emailProvider?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
}

const TRANSPORTER_TTL_MS = 10 * 60 * 1000;

const transporterCache = new Map<
  string,
  { transporter: Transporter; createdAt: number }
>();

function getCacheKey(settings: EmailSettings): string {
  return `${settings.emailProvider || "brevo"}:${settings.smtpUser || ""}:${settings.smtpHost || ""}:${settings.smtpPort || ""}`;
}

function getBrevoTransporter(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 3,
  });
}

export function getTransporterForUser(settings: EmailSettings): Transporter {
  const key = getCacheKey(settings);
  const cached = transporterCache.get(key);
  if (cached && Date.now() - cached.createdAt < TRANSPORTER_TTL_MS) {
    return cached.transporter;
  }

  if (cached) {
    cached.transporter.close?.();
    transporterCache.delete(key);
  }

  const provider = settings.emailProvider || "brevo";
  const smtpPassword = settings.smtpPass
    ? isEncrypted(settings.smtpPass)
      ? decrypt(settings.smtpPass)
      : settings.smtpPass
    : undefined;

  const baseOpts = {
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 30000,
    pool: true as const,
    maxConnections: 3,
  };

  let transporter: Transporter;

  switch (provider) {
    case "gmail":
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: settings.smtpUser ?? undefined,
          pass: smtpPassword,
        },
        ...baseOpts,
      });
      break;
    case "outlook":
      transporter = nodemailer.createTransport({
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false,
        auth: {
          user: settings.smtpUser ?? undefined,
          pass: smtpPassword,
        },
        ...baseOpts,
      });
      break;
    case "custom": {
      const port = settings.smtpPort ?? 587;
      transporter = nodemailer.createTransport({
        host: settings.smtpHost ?? undefined,
        port,
        secure: port === 465,
        auth: {
          user: settings.smtpUser ?? undefined,
          pass: smtpPassword,
        },
        ...baseOpts,
      });
      break;
    }
    default:
      transporter = getBrevoTransporter();
  }

  transporterCache.set(key, { transporter, createdAt: Date.now() });
  return transporter;
}

let systemTransporter: Transporter | null = null;

export function getSystemTransporter(): Transporter {
  if (!systemTransporter) {
    systemTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return systemTransporter;
}

/**
 * Returns the notification "from" address, or null if no valid sender is configured.
 * Avoids falling back to a non-existent domain that would cause silent delivery failures.
 */
export function getNotificationFrom(): string | null {
  const email = process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER;
  if (!email) {
    console.warn("[Email] No NOTIFICATION_EMAIL or SMTP_USER configured — cannot send notifications");
    return null;
  }
  return `JobPilot <${email}>`;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const classified = classifyError(err);
      if (!classified.retryable || attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

export interface SendNotificationEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendNotificationEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendNotificationEmail(
  options: SendNotificationEmailOptions,
): Promise<SendNotificationEmailResult> {
  const transporter = getSystemTransporter();
  try {
    const info = await withRetry(() =>
      transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      }),
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCoverLetterHtml(
  coverLetter: string,
  signature?: string | null,
): string {
  const safeCoverLetter = escapeHtml(coverLetter);
  const paragraphs = safeCoverLetter
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px 0;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const sig = signature
    ? `<p style="margin-top:20px;color:#666;font-size:13px">${escapeHtml(signature).replace(/\n/g, "<br>")}</p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;max-width:600px">
      ${body}
      ${sig}
    </div>
  `;
}
