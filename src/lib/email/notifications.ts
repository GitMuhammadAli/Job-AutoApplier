import { sendNotificationEmail, getNotificationFrom } from "@/lib/email";
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

  const from = getNotificationFrom();
  if (!from) return;

  const { subject, html } = newJobsNotificationTemplate(userName, jobs);

  await sendNotificationEmail({
    from,
    to: recipientEmail,
    subject,
    html,
  });
}
