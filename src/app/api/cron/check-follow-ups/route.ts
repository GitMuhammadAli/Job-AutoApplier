import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithGroq } from "@/lib/groq";
import { LIMITS, TIMEOUTS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const candidates = await prisma.userJob.findMany({
      where: {
        stage: "APPLIED",
        isDismissed: false,
        followUpCount: { lt: 2 },
        OR: [
          { lastFollowUpAt: null, updatedAt: { lte: sevenDaysAgo } },
          { lastFollowUpAt: { lte: sevenDaysAgo } },
        ],
      },
      take: LIMITS.FOLLOW_UP_BATCH,
      include: {
        globalJob: true,
        application: true,
        user: { include: { settings: true } },
      },
    });

    let generated = 0;

    for (const userJob of candidates) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      if (
        !userJob.user.settings ||
        userJob.user.settings.accountStatus !== "active"
      )
        continue;
      if (!userJob.application) continue;

      try {
        const settings = userJob.user.settings;
        const langInstruction =
          settings.emailLanguage && settings.emailLanguage !== "English"
            ? `Write in ${settings.emailLanguage}.`
            : "";

        const followUp = await generateWithGroq(
          `You are a professional follow-up email writer. Write a SHORT polite follow-up (50-100 words).
${langInstruction}
Return ONLY JSON: {"subject":"Re: ...","body":"..."}`,
          `Original application:
Position: ${userJob.globalJob.title} at ${userJob.globalJob.company}
Applied: ${userJob.application.sentAt?.toISOString() || "recently"}
Original subject: ${userJob.application.subject}

Write a brief, warm follow-up checking on the status.`,
          { temperature: 0.6, max_tokens: 300 },
        );

        const cleaned = followUp
          .replace(/```json\n?/g, "")
          .replace(/```/g, "")
          .trim();
        let parsed: { subject: string; body: string };
        try {
          parsed = JSON.parse(cleaned) as { subject: string; body: string };
        } catch {
          console.warn(
            `[FollowUp] JSON parse failed for job ${userJob.id}, skipping`,
          );
          continue;
        }

        await prisma.jobApplication.update({
          where: { id: userJob.application.id },
          data: {
            followUpSubject: parsed.subject,
            followUpBody: parsed.body,
            followUpStatus: "DRAFT",
          },
        });

        await prisma.$transaction([
          prisma.userJob.update({
            where: { id: userJob.id },
            data: {
              followUpCount: { increment: 1 },
              lastFollowUpAt: new Date(),
            },
          }),
          prisma.activity.create({
            data: {
              userJobId: userJob.id,
              userId: userJob.userId,
              type: "FOLLOW_UP_FLAGGED",
              description: `Follow-up draft generated for ${userJob.globalJob.company}`,
            },
          }),
        ]);

        generated++;
      } catch (err) {
        console.error(`[FollowUp] Error for job ${userJob.id}:`, err);
      }
    }

    await prisma.systemLog.create({
      data: {
        type: "follow-up",
        source: "check-follow-ups",
        message: `Generated ${generated} follow-up drafts from ${candidates.length} candidates`,
      },
    });

    return NextResponse.json({
      candidates: candidates.length,
      generated,
    });
  } catch (error) {
    return handleRouteError("CheckFollowUps", error, "Check follow-ups failed");
  }
}
