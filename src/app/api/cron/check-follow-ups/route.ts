import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIMITS, TIMEOUTS, FOLLOW_UP } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import { generateFollowUpEmail } from "@/lib/ai/generate-followup";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("check-follow-ups");
  const startTime = Date.now();

  try {
    // Default delay window — settings.followUpDelayDays per-user overrides.
    // We use the most generous DB filter (≥ shortest possible delay) and
    // recheck per-user in the loop, since UserJob doesn't know the user's
    // delay setting without a join.
    const minDelayDays = FOLLOW_UP.FOLLOW_UP_AFTER_DAYS;
    const earliestCutoff = new Date(Date.now() - minDelayDays * 24 * 60 * 60 * 1000);

    const candidates = await prisma.userJob.findMany({
      where: {
        stage: "APPLIED",
        isDismissed: false,
        followUpCount: { lt: FOLLOW_UP.MAX_FOLLOW_UPS },
        // Only users who explicitly opted in. Default is off — generating
        // follow-up drafts for everyone would surprise users who didn't ask.
        user: {
          settings: {
            followUpEnabled: true,
            accountStatus: "active",
          },
        },
        OR: [
          { lastFollowUpAt: null, updatedAt: { lte: earliestCutoff } },
          { lastFollowUpAt: { lte: earliestCutoff } },
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
    let failed = 0;

    for (const userJob of candidates) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      if (
        !userJob.user.settings ||
        userJob.user.settings.accountStatus !== "active" ||
        !userJob.user.settings.followUpEnabled
      )
        continue;
      if (!userJob.application) continue;

      // Per-user delay + max enforcement. The DB filter used the global
      // minimum delay; here we re-check against this user's preferred
      // delay and max count to avoid generating one day too early or
      // one too many times.
      const userDelayDays = userJob.user.settings.followUpDelayDays ?? FOLLOW_UP.FOLLOW_UP_AFTER_DAYS;
      const userMaxFollowUps = userJob.user.settings.maxFollowUpsPerApp ?? FOLLOW_UP.MAX_FOLLOW_UPS;
      if (userJob.followUpCount >= userMaxFollowUps) continue;
      const referenceTime = userJob.lastFollowUpAt ?? userJob.updatedAt;
      const daysSinceReference = (Date.now() - referenceTime.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceReference < userDelayDays) continue;

      try {
        const settings = userJob.user.settings;

        const sentAt = userJob.application.sentAt ?? userJob.application.createdAt;
        const daysSinceApplied = sentAt
          ? Math.floor((Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24))
          : 7;

        let parsed: { subject: string; body: string };
        try {
          parsed = await generateFollowUpEmail({
            originalSubject: userJob.application.subject ?? `Application for ${userJob.globalJob.title}`,
            originalBody: userJob.application.emailBody ?? "",
            jobTitle: userJob.globalJob.title,
            companyName: userJob.globalJob.company,
            daysSinceApplied,
            emailLanguage: settings.emailLanguage,
          });
        } catch (aiErr) {
          console.warn(`[FollowUp] AI generation failed for job ${userJob.id}, skipping:`, aiErr instanceof Error ? aiErr.message : aiErr);
          failed++;
          continue;
        }

        await prisma.$transaction([
          prisma.jobApplication.update({
            where: { id: userJob.application.id },
            data: {
              followUpSubject: parsed.subject,
              followUpBody: parsed.body,
              followUpStatus: "DRAFT",
            },
          }),
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
        failed++;
      }
    }

    await prisma.systemLog.create({
      data: {
        type: "follow-up",
        source: "check-follow-ups",
        message: `Generated ${generated} follow-up drafts from ${candidates.length} candidates (${failed} errors)`,
      },
    });

    await tracker.success({ processed: generated, failed, metadata: { candidates: candidates.length } });

    return NextResponse.json({
      candidates: candidates.length,
      generated,
      failed,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("CheckFollowUps", error, "Check follow-ups failed");
  }
}
