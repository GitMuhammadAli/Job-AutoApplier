import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildWeeklyReport } from "@/lib/email/weekly-report";
import nodemailer from "nodemailer";
import { CRON } from "@/lib/messages";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: CRON.UNAUTHORIZED }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { settings: { emailNotifications: true } },
    select: { id: true, email: true },
  });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    const report = await buildWeeklyReport(user.id);
    if (!report) continue;

    try {
      await transporter.sendMail({
        from: `"JobPilot" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "Your Weekly Job Search Report — JobPilot",
        html: report.html,
      });
      sent++;
    } catch (e) {
      console.error(`Weekly report to ${user.email} failed:`, e);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
