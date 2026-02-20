import { sendEmail } from "@/lib/email/sender";
import { newJobsNotificationTemplate } from "@/lib/email-templates";
import { checkNotificationLimit, recordNotification } from "@/lib/notification-limiter";

interface MatchedJobNotification {
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  matchScore: number;
  applyUrl: string | null;
  source: string;
  matchReasons: string[];
}

/**
 * Send new job match notification via system transporter (Brevo).
 * Respects frequency limits (1/hour, 3/day).
 */
export async function sendNewJobsNotification(
  userId: string,
  email: string,
  userName: string,
  matchedJobs: MatchedJobNotification[]
): Promise<boolean> {
  if (matchedJobs.length === 0) return false;

  const canNotify = await checkNotificationLimit(userId);
  if (!canNotify) return false;

  const { subject, html } = newJobsNotificationTemplate(userName, matchedJobs);

  const result = await sendEmail({
    from: `JobPilot <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "notifications@jobpilot.app"}>`,
    to: email,
    subject,
    html,
  });

  if (result.success) {
    await recordNotification(
      userId,
      `Sent ${matchedJobs.length} job match notification to ${email}`
    );
    return true;
  }

  return false;
}
