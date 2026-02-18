import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/matching/score-engine";
import { sendEmail } from "@/lib/email/sender";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

/**
 * Runs 3x daily for all users.
 * Matches non-fresh GlobalJobs (fresh ones are handled by instant-apply) to users.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.userSettings.findMany({
      where: { isOnboarded: true, keywords: { isEmpty: false } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No configured users", matched: 0 });
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const unmatchedJobs = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        createdAt: { gte: threeDaysAgo },
      },
    });

    if (unmatchedJobs.length === 0) {
      return NextResponse.json({ message: "No recent jobs to match", matched: 0 });
    }

    const results: { userId: string; matched: number }[] = [];

    for (const settings of users) {
      const userId = settings.userId;
      const resumes = await prisma.resume.findMany({
        where: { userId },
        select: { id: true, name: true, content: true, isDefault: true },
      });

      const existingJobIds = new Set(
        (await prisma.userJob.findMany({
          where: { userId },
          select: { globalJobId: true },
        })).map((j) => j.globalJobId)
      );

      let matched = 0;

      for (const job of unmatchedJobs) {
        if (existingJobIds.has(job.id)) continue;

        const match = computeMatchScore(job, settings, resumes);
        if (match.score < 20) continue;

        try {
          await prisma.userJob.create({
            data: {
              userId,
              globalJobId: job.id,
              stage: "SAVED",
              matchScore: match.score,
              matchReasons: match.reasons,
            },
          });
          matched++;
        } catch {
          // Duplicate constraint
        }
      }

      if (matched > 0 && settings.emailNotifications) {
        const notifEmail = settings.notificationEmail || settings.user.email;
        if (notifEmail) {
          try {
            await sendEmail({
              from: `JobPilot <${process.env.NOTIFICATION_EMAIL || "noreply@jobpilot.app"}>`,
              to: notifEmail,
              subject: `JobPilot: ${matched} new job matches`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#1e293b;">📋 ${matched} new job matches found</h2>
                <p style="color:#64748b;">Review them on your dashboard to start applying.</p>
                <a href="${process.env.NEXTAUTH_URL || "https://jobpilot.vercel.app"}" style="display:inline-block;margin-top:12px;background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View Jobs →</a>
              </div>`,
            });
          } catch {}
        }
      }

      results.push({ userId, matched });
    }

    const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);

    return NextResponse.json({
      success: true,
      users: users.length,
      availableJobs: unmatchedJobs.length,
      totalMatched,
      perUser: results,
    });
  } catch (error) {
    console.error("Match all users error:", error);
    return NextResponse.json(
      { error: "Match failed", details: String(error) },
      { status: 500 }
    );
  }
}
