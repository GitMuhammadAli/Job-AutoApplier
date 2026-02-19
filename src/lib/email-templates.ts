const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://jobpilot.app";

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 20px">
    <h1 style="color:#fff;margin:0;font-size:20px">${title}</h1>
  </div>
  <div style="padding:24px 20px">
    ${body}
  </div>
  <div style="padding:16px 20px;border-top:1px solid #f1f5f9;text-align:center">
    <a href="${APP_URL}" style="color:#64748b;font-size:11px;text-decoration:none">JobPilot</a>
    <span style="color:#cbd5e1;margin:0 8px">·</span>
    <a href="${APP_URL}/settings" style="color:#64748b;font-size:11px;text-decoration:none">Manage Notifications</a>
  </div>
</div>
</body>
</html>`;
}

interface MatchedJob {
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  matchScore: number;
  applyUrl: string | null;
  source: string;
  matchReasons: string[];
}

export function newJobsNotificationTemplate(
  userName: string,
  jobs: MatchedJob[]
): { subject: string; html: string } {
  const rows = jobs
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((j) => {
      const scoreColor = j.matchScore >= 70 ? "#059669" : j.matchScore >= 40 ? "#d97706" : "#6b7280";
      return `<tr>
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
      </tr>`;
    })
    .join("");

  const body = `
    <p style="color:#475569;font-size:14px;margin:0 0 16px">Hi ${userName}, we found <strong>${jobs.length}</strong> new job${jobs.length > 1 ? "s" : ""} matching your profile:</p>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Job</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Match</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:center;margin-top:20px">
      <a href="${APP_URL}" style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">View All Jobs</a>
    </div>`;

  return {
    subject: `${jobs.length} new job match${jobs.length > 1 ? "es" : ""} — ${jobs[0].title} at ${jobs[0].company}${jobs.length > 1 ? ` +${jobs.length - 1} more` : ""}`,
    html: layout(`JobPilot — New Matches`, body),
  };
}

export function autoApplySummaryTemplate(
  userName: string,
  applied: Array<{ title: string; company: string; sentAt: string }>,
  failed: number
): { subject: string; html: string } {
  const rows = applied
    .map(
      (a) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${a.title}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${a.company}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8">${a.sentAt}</td>
        </tr>`
    )
    .join("");

  const body = `
    <p style="color:#475569;font-size:14px;margin:0 0 16px">Hi ${userName}, here's your auto-apply summary:</p>
    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1;background:#ecfdf5;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#059669">${applied.length}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">Sent</div>
      </div>
      ${failed > 0 ? `<div style="flex:1;background:#fef2f2;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#dc2626">${failed}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">Failed</div>
      </div>` : ""}
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">Job</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">Company</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">Sent</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:center;margin-top:20px">
      <a href="${APP_URL}/applications" style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">View Applications</a>
    </div>`;

  return {
    subject: `Auto-apply summary: ${applied.length} sent${failed > 0 ? `, ${failed} failed` : ""}`,
    html: layout("Auto-Apply Summary", body),
  };
}

export function followUpReminderTemplate(
  userName: string,
  jobs: Array<{ title: string; company: string; daysSince: number; userJobId: string }>
): { subject: string; html: string } {
  const rows = jobs
    .map(
      (j) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">
            <div style="font-weight:600;color:#1e293b;font-size:13px">${j.title}</div>
            <div style="font-size:12px;color:#64748b">${j.company}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#d97706">${j.daysSince} days ago</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center">
            <a href="${APP_URL}/jobs/${j.userJobId}" style="display:inline-block;padding:6px 14px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600">Follow Up</a>
          </td>
        </tr>`
    )
    .join("");

  const body = `
    <p style="color:#475569;font-size:14px;margin:0 0 16px">Hi ${userName}, these applications might benefit from a follow-up:</p>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">Job</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600">Applied</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600">Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  return {
    subject: `Follow-up reminder: ${jobs.length} application${jobs.length > 1 ? "s" : ""} need attention`,
    html: layout("Follow-Up Reminder", body),
  };
}

export function welcomeEmailTemplate(userName: string): { subject: string; html: string } {
  const body = `
    <p style="color:#475569;font-size:14px;margin:0 0 16px">Hi ${userName}, welcome to <strong>JobPilot</strong>!</p>
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px">
      Your account is set up. Here's what happens next:
    </p>
    <ol style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;margin:0 0 20px">
      <li>We scrape 8 job boards every 30 minutes</li>
      <li>AI matches jobs against your keywords and resume</li>
      <li>Matched jobs appear on your Kanban board</li>
      <li>You review, edit, and send (or let AI auto-apply)</li>
    </ol>
    <div style="text-align:center;margin-top:20px">
      <a href="${APP_URL}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Go to Dashboard</a>
    </div>`;

  return {
    subject: "Welcome to JobPilot — Your AI Job Assistant",
    html: layout("Welcome to JobPilot", body),
  };
}

export function bounceAlertTemplate(
  userName: string,
  bouncedEmail: string,
  reason: string
): { subject: string; html: string } {
  const body = `
    <p style="color:#475569;font-size:14px;margin:0 0 16px">Hi ${userName},</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="color:#991b1b;font-size:13px;margin:0 0 8px;font-weight:600">Email Bounce Detected</p>
      <p style="color:#7f1d1d;font-size:12px;margin:0 0 4px"><strong>To:</strong> ${bouncedEmail}</p>
      <p style="color:#7f1d1d;font-size:12px;margin:0"><strong>Reason:</strong> ${reason}</p>
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px">
      Auto-sending has been paused for 24 hours to protect your email reputation.
      Please check the email address and resume sending from Settings when ready.
    </p>
    <div style="text-align:center;margin-top:20px">
      <a href="${APP_URL}/settings" style="display:inline-block;padding:10px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Review Settings</a>
    </div>`;

  return {
    subject: "Email Bounce Alert — Auto-Sending Paused",
    html: layout("Email Bounce Alert", body),
  };
}
