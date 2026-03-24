import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFollowUpEmail } from "@/lib/ai/generate-followup";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find sent applications with no follow-up, sent 7+ days ago
  const apps = await prisma.jobApplication.findMany({
    where: {
      status: "SENT",
      sentAt: { lte: sevenDaysAgo },
      followUpStatus: null,
    },
    include: {
      userJob: { include: { globalJob: true } },
      user: { include: { settings: true } },
    },
    take: 10,
  });

  const results = [];

  for (const app of apps) {
    try {
      const daysSince = Math.floor(
        (Date.now() - (app.sentAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24)
      );

      const followUp = await generateFollowUpEmail({
        originalSubject: app.subject,
        originalBody: app.emailBody,
        jobTitle: app.userJob.globalJob.title,
        companyName: app.userJob.globalJob.company,
        daysSinceApplied: daysSince,
      });

      await prisma.jobApplication.update({
        where: { id: app.id },
        data: {
          followUpSubject: followUp.subject,
          followUpBody: followUp.body,
          followUpStatus: "DRAFT",
        },
      });

      results.push({ appId: app.id, status: "draft_created" });
    } catch (e) {
      results.push({ appId: app.id, status: "error", error: String(e) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
