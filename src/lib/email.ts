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

// ── Per-job email alert ──
interface JobEmailData {
  company: string;
  role: string;
  url: string;
  platform: string;
  location: string;
  salary: string | null;
  description: string;
  applyType: string;
  isDirectApply: boolean;
  matchScore: number;
  recommendedResume: string;
  resumeFileUrl: string | null;
  matchedSkills?: string[];
  source: string;
}

const APPLY_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  EASY_APPLY: { bg: "#d1fae5", color: "#059669", label: "Easy Apply" },
  QUICK_APPLY: { bg: "#dbeafe", color: "#2563eb", label: "Quick Apply" },
  REGULAR: { bg: "#f1f5f9", color: "#475569", label: "Regular Application" },
  EMAIL: { bg: "#fef3c7", color: "#d97706", label: "Email Application" },
  UNKNOWN: { bg: "#f1f5f9", color: "#94a3b8", label: "Apply" },
};

function applyTypeBadgeHtml(applyType: string): string {
  const style = APPLY_TYPE_STYLES[applyType] || APPLY_TYPE_STYLES.UNKNOWN;
  return `<span style="display:inline-block;background:${style.bg};color:${style.color};padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">${style.label}</span>`;
}

function matchScoreBarHtml(score: number): string {
  const color = score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#94a3b8";
  return `
    <div style="margin-top:8px;">
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Match Score: <strong style="color:${color};">${score}%</strong></div>
      <div style="background:#f1f5f9;border-radius:4px;height:6px;width:120px;">
        <div style="background:${color};border-radius:4px;height:6px;width:${Math.min(score, 100)}%;"></div>
      </div>
    </div>`;
}

export async function sendJobEmail(job: JobEmailData) {
  const applyStyle = APPLY_TYPE_STYLES[job.applyType] || APPLY_TYPE_STYLES.UNKNOWN;
  const isEasy = job.applyType === "EASY_APPLY";

  const intro = isEasy
    ? `This <strong>${job.role}</strong> at <strong>${job.company}</strong> is an <span style="color:${applyStyle.color};font-weight:600;">Easy Apply</span> position -- takes about 30 seconds to apply. Your "${job.recommendedResume}" resume is a great fit.`
    : `This <strong>${job.role}</strong> at <strong>${job.company}</strong> matches your skills. ${job.applyType === "QUICK_APPLY" ? "Quick apply available." : "Standard application form."} We recommend using your "${job.recommendedResume}" resume.`;

  const descSnippet = job.description
    ? job.description.replace(/<[^>]*>/g, "").substring(0, 300) + (job.description.length > 300 ? "..." : "")
    : "";

  const html = wrapHtml(
    `${job.role} at ${job.company}`,
    `
    <div style="margin-bottom:12px;">
      ${applyTypeBadgeHtml(job.applyType)}
      <span style="display:inline-block;background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:500;margin-left:6px;">${job.source}</span>
    </div>

    <h2 style="color:#1e293b;font-size:20px;margin:0 0 4px 0;">${job.role}</h2>
    <div style="font-size:14px;color:#475569;margin-bottom:12px;">
      <strong>${job.company}</strong>${job.location ? ` &middot; ${job.location}` : ""}${job.salary ? ` &middot; <span style="color:#059669;font-weight:600;">${job.salary}</span>` : ""}
    </div>

    <p style="font-size:13px;color:#334155;line-height:1.6;margin:0 0 12px 0;">${intro}</p>

    ${matchScoreBarHtml(job.matchScore)}

    ${job.matchedSkills && job.matchedSkills.length > 0
      ? `<div style="margin-top:12px;">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">Skills Matched:</div>
          <div>${job.matchedSkills.map((s) => `<span style="display:inline-block;background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;margin:2px 3px 2px 0;">${s}</span>`).join("")}</div>
        </div>`
      : ""
    }

    ${descSnippet ? `<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;"><p style="font-size:12px;color:#64748b;line-height:1.6;margin:0;">${descSnippet}</p></div>` : ""}

    <div style="margin-top:16px;">
      <span style="display:inline-block;background:#eef2ff;color:#4338ca;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">Recommended Resume: ${job.recommendedResume}</span>
      ${job.resumeFileUrl ? `<a href="${job.resumeFileUrl}" style="display:inline-block;color:#2563eb;font-size:12px;margin-left:8px;text-decoration:underline;">Download Resume</a>` : ""}
    </div>

    <div style="margin-top:20px;text-align:center;">
      <a href="${job.url}" style="display:inline-block;background:${isEasy ? "#059669" : "#2563eb"};color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        ${isEasy ? "Easy Apply Now" : "Apply Now"}
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center;">
      ${isEasy ? "This is a quick one-click application. Have your resume ready!" : "Open your recommended resume before clicking Apply."}
    </p>
    `
  );

  await sendEmail(
    TO,
    `[JobPilot] ${isEasy ? "[Easy Apply] " : ""}${job.role} at ${job.company}`,
    html
  );
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
