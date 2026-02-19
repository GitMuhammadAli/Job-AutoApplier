import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { getTransporterForUser } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await getAuthUserId();
    const settings = await prisma.userSettings.findUnique({ where: { userId } });

    if (!settings) {
      return NextResponse.json(
        { success: false, error: "Settings not found" },
        { status: 404 }
      );
    }

    if (!settings.smtpUser && settings.emailProvider !== "brevo") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Email not configured. Set up Gmail or Outlook in Settings first.",
          hint: "Go to Settings → Email Provider and enter your credentials.",
        },
        { status: 400 }
      );
    }

    if (settings.emailProvider === "brevo") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Email provider is set to Brevo. Switch to Gmail or Outlook to send a test.",
          hint: "Brevo uses the system email server and doesn't need testing.",
        },
        { status: 400 }
      );
    }

    const fromEmail = settings.applicationEmail || settings.smtpUser || "";
    if (!fromEmail) {
      return NextResponse.json(
        { success: false, error: "No sender email configured" },
        { status: 400 }
      );
    }

    const transporter = getTransporterForUser(settings);

    await transporter.verify();

    await transporter.sendMail({
      from: `${settings.fullName || "JobPilot"} <${fromEmail}>`,
      to: fromEmail,
      subject: "JobPilot — Your Email is Working!",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#18181b;">Email Verified</h2>
          <p style="color:#52525b;line-height:1.6;">
            This is a test from JobPilot. If you're reading this in your inbox
            (not spam), your email is configured correctly.
          </p>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;">
            <strong>Your setup:</strong><br>
            Sending from: ${fromEmail}<br>
            Display name: ${settings.fullName || "Not set"}<br>
            Provider: ${settings.emailProvider}
          </div>
          <p style="color:#52525b;">
            Application emails will be sent from this address. HR will see a normal
            email from you — no spam warnings.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, sentTo: fromEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    const responseCode =
      error && typeof error === "object" && "responseCode" in error
        ? (error as { responseCode?: number }).responseCode
        : undefined;

    let hint = "Check your SMTP settings.";

    if (responseCode === 535 || code === "EAUTH") {
      hint =
        "Invalid password. For Gmail, use an App Password — not your regular Gmail password. Go to myaccount.google.com → Security → App Passwords.";
    } else if (responseCode === 534) {
      hint =
        "2-Step Verification is not enabled on your Google account. Enable it first, then create an App Password.";
    } else if (code === "ESOCKET" || code === "ECONNREFUSED") {
      hint =
        "Can't connect to mail server. Check host and port settings.";
    } else if (code === "ETIMEDOUT") {
      hint =
        "Connection timed out. The mail server may be blocking this connection.";
    } else if (message.includes("535")) {
      hint =
        "Invalid password. For Gmail, use an App Password (not your regular password).";
    } else if (message.includes("ECONNREFUSED")) {
      hint = "Cannot connect to SMTP server. Check host and port.";
    }

    return NextResponse.json(
      { success: false, error: message, hint },
      { status: 400 }
    );
  }
}
