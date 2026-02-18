import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || options.from,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}

export function formatCoverLetterHtml(coverLetter: string, signature?: string | null): string {
  const paragraphs = coverLetter.split("\n\n").map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px 0;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const sig = signature ? `<p style="margin-top:20px;color:#666;font-size:13px">${signature.replace(/\n/g, "<br>")}</p>` : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;max-width:600px">
      ${body}
      ${sig}
    </div>
  `;
}
