import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { getTransporterForUser } from "@/lib/email";
import { decryptSettingsFields } from "@/lib/encryption";
import { EMAIL, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await getAuthUserId();
    const rawSettings = await prisma.userSettings.findUnique({ where: { userId } });

    if (!rawSettings) {
      return NextResponse.json(
        { success: false, error: EMAIL.SETTINGS_NOT_FOUND },
        { status: 404 }
      );
    }
    const settings = decryptSettingsFields(rawSettings);

    if (!settings.smtpUser && settings.emailProvider !== "brevo") {
      return NextResponse.json(
        {
          success: false,
          error: EMAIL.NOT_CONFIGURED,
          hint: EMAIL.NOT_CONFIGURED_HINT,
        },
        { status: 400 }
      );
    }

    if (settings.emailProvider === "brevo") {
      return NextResponse.json(
        {
          success: false,
          error: EMAIL.BREVO_SET_PROVIDER,
          hint: EMAIL.BREVO_HINT,
        },
        { status: 400 }
      );
    }

    const fromEmail = settings.applicationEmail || settings.smtpUser || "";
    if (!fromEmail) {
      return NextResponse.json(
        { success: false, error: EMAIL.NO_SENDER },
        { status: 400 }
      );
    }

    const transporter = getTransporterForUser(settings);

    await transporter.verify();

    await transporter.sendMail({
      from: `${settings.fullName || "JobPilot"} <${fromEmail}>`,
      to: fromEmail,
      subject: EMAIL.TEST_SUBJECT,
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

    // Mark SMTP as verified for readiness checker
    await prisma.userSettings.update({
      where: { userId },
      data: { smtpVerifiedAt: new Date() },
    });

    return NextResponse.json({ success: true, sentTo: fromEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : GENERIC.UNKNOWN_ERROR;
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    const responseCode =
      error && typeof error === "object" && "responseCode" in error
        ? (error as { responseCode?: number }).responseCode
        : undefined;

    let hint: string = EMAIL.HINT_DEFAULT;

    if (responseCode === 535 || code === "EAUTH") {
      hint = EMAIL.HINT_GMAIL_APP_PASSWORD;
    } else if (responseCode === 534) {
      hint = EMAIL.HINT_2FA_REQUIRED;
    } else if (code === "ESOCKET" || code === "ECONNREFUSED") {
      hint = EMAIL.HINT_CANT_CONNECT;
    } else if (code === "ETIMEDOUT") {
      hint = EMAIL.HINT_CONNECTION_TIMED_OUT;
    } else if (message.includes("535")) {
      hint = EMAIL.HINT_GMAIL_APP_PASSWORD_SHORT;
    } else if (message.includes("ECONNREFUSED")) {
      hint = EMAIL.HINT_ECONNREFUSED;
    }

    return NextResponse.json(
      { success: false, error: message, hint },
      { status: 400 }
    );
  }
}
