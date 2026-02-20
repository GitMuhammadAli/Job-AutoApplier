import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { decrypt, isEncrypted } from "@/lib/encryption";

export interface EmailSettings {
  emailProvider?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
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
  });
}

export function getTransporterForUser(settings: EmailSettings): Transporter {
  const provider = settings.emailProvider || "brevo";
  const smtpPassword = settings.smtpPass
    ? (isEncrypted(settings.smtpPass) ? decrypt(settings.smtpPass) : settings.smtpPass)
    : undefined;

  switch (provider) {
    case "gmail":
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: settings.smtpUser ?? undefined,
          pass: smtpPassword,
        },
      });
    case "outlook":
      return nodemailer.createTransport({
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false,
        auth: {
          user: settings.smtpUser ?? undefined,
          pass: smtpPassword,
        },
      });
    case "custom":
      return nodemailer.createTransport({
        host: settings.smtpHost ?? undefined,
        port: settings.smtpPort ?? 587,
        secure: false,
        auth: {
          user: settings.smtpUser ?? undefined,
          pass: smtpPassword,
        },
      });
    default:
      return getBrevoTransporter();
  }
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

export interface SendApplicationEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface SendApplicationEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";
      const isTransient = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|421|451|temporary/i.test(msg);
      if (!isTransient || attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

export async function sendApplicationEmail(
  options: SendApplicationEmailOptions,
  transporter: Transporter
): Promise<SendApplicationEmailResult> {
  try {
    const info = await withRetry(() =>
      transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      })
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
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
  options: SendNotificationEmailOptions
): Promise<SendNotificationEmailResult> {
  const transporter = getBrevoTransporter();
  try {
    const info = await withRetry(() =>
      transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      })
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

export function formatCoverLetterHtml(coverLetter: string, signature?: string | null): string {
  const paragraphs = coverLetter
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 12px 0;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const sig = signature
    ? `<p style="margin-top:20px;color:#666;font-size:13px">${signature.replace(/\n/g, "<br>")}</p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;max-width:600px">
      ${body}
      ${sig}
    </div>
  `;
}
