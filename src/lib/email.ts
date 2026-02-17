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

const FROM = process.env.NOTIFICATION_EMAIL || "alishahid.works@gmail.com";
const TO = process.env.NOTIFICATION_EMAIL || "alishahid.works@gmail.com";

function wrapHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
        <span style="font-size:20px;font-weight:700;color:#1e293b;">JobPilot</span>
      </div>
      ${body}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">
      JobPilot - Automated Job Application Tracker
    </p>
  </div>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: `"JobPilot" <${FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent: ${subject}`);
  } catch (err) {
    console.error("Email send failed:", err);
    throw err;
  }
}

// ── New job found alert ──
interface NewJobData {
  company: string;
  role: string;
  url?: string | null;
  platform: string;
  location?: string | null;
  salary?: string | null;
  notes?: string | null;
  recommendedResume?: string;
}

export async function sendNewJobAlert(jobs: NewJobData[]) {
  if (jobs.length === 0) return;

  const jobCards = jobs
    .map(
      (job) => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="font-size:16px;font-weight:600;color:#1e293b;">${job.role}</div>
      <div style="font-size:13px;color:#64748b;margin-top:2px;">${job.company}${job.location ? ` · ${job.location}` : ""}${job.salary ? ` · ${job.salary}` : ""}</div>
      <div style="margin-top:8px;">
        <span style="display:inline-block;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;">${job.platform}</span>
        ${job.recommendedResume ? `<span style="display:inline-block;background:#eef2ff;color:#4338ca;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;margin-left:4px;">Use: ${job.recommendedResume}</span>` : ""}
      </div>
      ${job.notes ? `<p style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.5;">${job.notes.substring(0, 200)}${job.notes.length > 200 ? "..." : ""}</p>` : ""}
      ${job.url ? `<a href="${job.url}" style="display:inline-block;margin-top:10px;background:#2563eb;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;">Apply Now</a>` : ""}
    </div>`
    )
    .join("");

  const html = wrapHtml(
    `${jobs.length} New Job${jobs.length > 1 ? "s" : ""} Found`,
    `
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 4px 0;">${jobs.length} New Job${jobs.length > 1 ? "s" : ""} Found</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px 0;">Matching your search criteria. Click "Apply Now" to go directly to the application.</p>
    ${jobCards}
    <p style="color:#94a3b8;font-size:11px;margin-top:16px;">Tip: Open your recommended resume before clicking Apply to have it ready.</p>
    `
  );

  await sendEmail(TO, `[JobPilot] ${jobs.length} New Job${jobs.length > 1 ? "s" : ""} Found`, html);
}

// ── Follow-up reminder ──
interface FollowUpJob {
  company: string;
  role: string;
  daysAgo: number;
  url?: string | null;
}

export async function sendFollowUpReminder(jobs: FollowUpJob[]) {
  if (jobs.length === 0) return;

  const rows = jobs
    .map(
      (j) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:500;">${j.company}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${j.role}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#f59e0b;font-weight:500;">${j.daysAgo}d ago</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
        ${j.url ? `<a href="${j.url}" style="color:#2563eb;font-size:12px;text-decoration:none;">View</a>` : ""}
      </td>
    </tr>`
    )
    .join("");

  const html = wrapHtml(
    "Follow-up Reminder",
    `
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 4px 0;">Follow-up Reminder</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px 0;">${jobs.length} application${jobs.length > 1 ? "s" : ""} need a follow-up.</p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Company</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Role</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Applied</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Link</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    `
  );

  await sendEmail(TO, `[JobPilot] ${jobs.length} Applications Need Follow-up`, html);
}

// ── Ghost alert ──
export async function sendGhostAlert(jobs: { company: string; role: string; daysAgo: number }[]) {
  if (jobs.length === 0) return;

  const list = jobs
    .map((j) => `<li style="margin-bottom:4px;font-size:13px;color:#64748b;"><strong style="color:#1e293b;">${j.company}</strong> - ${j.role} (${j.daysAgo}d with no response)</li>`)
    .join("");

  const html = wrapHtml(
    "Ghosted Applications",
    `
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 4px 0;">Ghosted Applications</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px 0;">${jobs.length} application${jobs.length > 1 ? "s" : ""} have been automatically marked as ghosted.</p>
    <ul style="padding-left:16px;">${list}</ul>
    <p style="color:#94a3b8;font-size:12px;margin-top:12px;">These jobs had no response after the configured ghost detection period.</p>
    `
  );

  await sendEmail(TO, `[JobPilot] ${jobs.length} Applications Ghosted`, html);
}

// ── Weekly digest ──
interface DigestStats {
  totalJobs: number;
  appliedThisWeek: number;
  interviews: number;
  offers: number;
  ghosted: number;
  responseRate: number;
}

export async function sendWeeklyDigest(stats: DigestStats) {
  const html = wrapHtml(
    "Weekly Digest",
    `
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 4px 0;">Weekly Digest</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px 0;">Here's your job search summary for this week.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#1e293b;">${stats.totalJobs}</div>
        <div style="font-size:11px;color:#64748b;">Total Jobs</div>
      </div>
      <div style="background:#eff6ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#2563eb;">${stats.appliedThisWeek}</div>
        <div style="font-size:11px;color:#64748b;">Applied This Week</div>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#d97706;">${stats.interviews}</div>
        <div style="font-size:11px;color:#64748b;">Interviews</div>
      </div>
      <div style="background:#d1fae5;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#059669;">${stats.offers}</div>
        <div style="font-size:11px;color:#64748b;">Offers</div>
      </div>
    </div>
    <div style="margin-top:16px;background:#f8fafc;border-radius:8px;padding:12px;text-align:center;">
      <div style="font-size:20px;font-weight:700;color:#8b5cf6;">${stats.responseRate}%</div>
      <div style="font-size:11px;color:#64748b;">Response Rate</div>
    </div>
    `
  );

  await sendEmail(TO, `[JobPilot] Weekly Digest - ${stats.appliedThisWeek} Applied, ${stats.responseRate}% Response Rate`, html);
}
