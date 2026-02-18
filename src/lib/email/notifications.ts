import { sendEmail } from "./sender";

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

  const jobRows = jobs
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((j) => {
      const scoreColor = j.matchScore >= 70 ? "#059669" : j.matchScore >= 40 ? "#d97706" : "#6b7280";
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #f1f5f9">
            <div style="font-weight:600;color:#1e293b">${j.title}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">${j.company}${j.location ? ` · ${j.location}` : ""}</div>
            ${j.salary ? `<div style="font-size:12px;color:#059669;margin-top:2px">${j.salary}</div>` : ""}
            ${j.matchReasons.length > 0 ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">${j.matchReasons.slice(0, 3).join(" · ")}</div>` : ""}
          </td>
          <td style="padding:12px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:middle">
            <span style="font-weight:700;color:${scoreColor};font-size:16px">${Math.round(j.matchScore)}%</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:middle">
            ${j.applyUrl ? `<a href="${j.applyUrl}" style="display:inline-block;padding:6px 14px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600">Apply</a>` : `<span style="color:#94a3b8;font-size:12px">${j.source}</span>`}
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 20px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">JobPilot — New Matches</h1>
        <p style="color:#dbeafe;margin:6px 0 0;font-size:13px">Hi ${userName}, we found ${jobs.length} new job${jobs.length > 1 ? "s" : ""} for you</p>
      </div>
      <div style="background:#fff;padding:0;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Job</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Match</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            ${jobRows}
          </tbody>
        </table>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">
        Sent by JobPilot · Manage notifications in Settings
      </p>
    </div>
  `;

  await sendEmail({
    from: `JobPilot <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "noreply@jobpilot.app"}>`,
    to: recipientEmail,
    subject: `${jobs.length} new job match${jobs.length > 1 ? "es" : ""} — ${jobs[0].title} at ${jobs[0].company}${jobs.length > 1 ? ` +${jobs.length - 1} more` : ""}`,
    html,
  });
}
