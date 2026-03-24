import { prisma } from "@/lib/prisma";

export async function buildWeeklyReport(userId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const apps = await prisma.jobApplication.findMany({
    where: { userId, sentAt: { gte: weekAgo } },
    include: { userJob: { include: { globalJob: true } } },
  });

  if (apps.length === 0) return null;

  const totalSent = apps.length;
  const totalReplied = apps.filter(a => a.userJob.stage === "INTERVIEW" || a.userJob.stage === "OFFER").length;
  const totalInterviews = apps.filter(a => a.userJob.stage === "INTERVIEW").length;
  const responseRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  const skillCounts = new Map<string, number>();
  for (const app of apps) {
    const skills = (app.userJob.globalJob.skills as string[]) ?? [];
    for (const s of skills) skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);
  }
  const topSkills = Array.from(skillCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([skill]) => skill);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0b;color:#e0e0e0;padding:32px;">
<div style="max-width:600px;margin:0 auto;">
<h1 style="color:#fff;font-size:24px;margin-bottom:8px;">Your Weekly Report</h1>
<p style="color:#888;font-size:14px;margin-bottom:32px;">Here's how your job search went this week.</p>
<table width="100%" cellpadding="0" cellspacing="16"><tr>
<td style="background:#1a1a1f;border-radius:12px;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#fff;">${totalSent}</div><div style="color:#888;font-size:13px;">Sent</div></td>
<td style="background:#1a1a1f;border-radius:12px;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#D6B4FC;">${totalReplied}</div><div style="color:#888;font-size:13px;">Replies</div></td>
<td style="background:#1a1a1f;border-radius:12px;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#CCFF00;">${totalInterviews}</div><div style="color:#888;font-size:13px;">Interviews</div></td>
</tr></table>
<div style="background:#1a1a1f;border-radius:12px;padding:20px;margin-bottom:16px;">
<h3 style="color:#fff;margin:0 0 12px;">Response Rate</h3>
<div style="background:#333;border-radius:8px;height:8px;overflow:hidden;"><div style="background:#D6B4FC;height:100%;width:${responseRate}%;border-radius:8px;"></div></div>
<p style="color:#888;font-size:13px;margin-top:8px;">${responseRate}% of applications got a response</p>
</div>
${topSkills.length > 0 ? `<div style="background:#1a1a1f;border-radius:12px;padding:20px;margin-bottom:16px;"><h3 style="color:#fff;margin:0 0 12px;">Top Skills</h3><p style="color:#ccc;font-size:14px;">${topSkills.join(", ")}</p></div>` : ""}
<p style="color:#555;font-size:12px;text-align:center;margin-top:32px;">JobPilot Weekly · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#D6B4FC;">Open Dashboard</a></p>
</div></body></html>`;

  return { totalSent, totalReplied, totalInterviews, responseRate, topSkills, html };
}
