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
      return NextResponse.json({ success: false, error: "Settings not found" }, { status: 404 });
    }

    const fromEmail = settings.applicationEmail || settings.smtpUser || "";
    if (!fromEmail) {
      return NextResponse.json({ success: false, error: "No sender email configured" }, { status: 400 });
    }

    const transporter = getTransporterForUser(settings);

    await transporter.sendMail({
      from: `${settings.fullName || "JobPilot"} <${fromEmail}>`,
      to: fromEmail,
      subject: "JobPilot — Test Email",
      text: "Your email is configured correctly. Applications will be sent from this address.",
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2 style="color:#16a34a;">Email configured correctly!</h2>
        <p>Applications will be sent from <strong>${fromEmail}</strong>.</p>
        <p style="color:#94a3b8;font-size:12px;">— JobPilot</p>
      </div>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    let hint = "Check your SMTP settings.";
    if (message.includes("535")) {
      hint = "Invalid password. For Gmail, use an App Password (not your regular password).";
    } else if (message.includes("ECONNREFUSED")) {
      hint = "Cannot connect to SMTP server. Check host and port.";
    }
    return NextResponse.json({ success: false, error: message, hint }, { status: 400 });
  }
}
