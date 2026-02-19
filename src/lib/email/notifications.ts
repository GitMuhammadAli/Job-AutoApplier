import { sendEmail } from "./sender";
import { newJobsNotificationTemplate } from "@/lib/email-templates";

interface JobNotification {
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  matchScore: number;
  applyUrl: string | null;
  source: string;
  matchReasons: string[];
}

export async function sendJobMatchNotification(
  recipientEmail: string,
  jobs: JobNotification[],
  userName: string
): Promise<void> {
  if (jobs.length === 0) return;

  const { subject, html } = newJobsNotificationTemplate(userName, jobs);

  await sendEmail({
    from: `JobPilot <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "noreply@jobpilot.app"}>`,
    to: recipientEmail,
    subject,
    html,
  });
}
