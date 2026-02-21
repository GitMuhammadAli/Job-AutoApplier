import nodemailer from "nodemailer";
import { TIMEOUTS } from "@/lib/constants";

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

function createTransporter(config?: SendEmailOptions["smtpConfig"]) {
  return nodemailer.createTransport({
    host: config?.host || process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: config?.port || parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: config?.user || process.env.SMTP_USER,
      pass: config?.pass || process.env.SMTP_PASS,
    },
    connectionTimeout: TIMEOUTS.SMTP_TIMEOUT_MS,
    greetingTimeout: TIMEOUTS.SMTP_TIMEOUT_MS,
    socketTimeout: TIMEOUTS.SMTP_TIMEOUT_MS,
  });
}

async function retrySendMail(
  fn: () => Promise<{ messageId: string }>,
  maxRetries = 3,
): Promise<{ messageId: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";
      const isTransient =
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("421") ||
        msg.includes("451") ||
        msg.includes("temporary");
      if (!isTransient || attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = createTransporter(options.smtpConfig);

  try {
    const info = await retrySendMail(() =>
      transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo || options.from,
      }),
    );

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[sendEmail] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  } finally {
    transporter.close();
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
