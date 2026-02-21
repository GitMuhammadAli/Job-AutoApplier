import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { pickBestResume } from "@/lib/matching/resume-matcher";
import { findCompanyEmail } from "@/lib/email-extractor";
import { isDuplicateApplication } from "@/lib/duplicate-checker";
import { sendApplication } from "@/lib/send-application";
import { sendNotificationEmail } from "@/lib/email";
import { decryptSettingsFields } from "@/lib/encryption";
import { generateWithGroq } from "@/lib/groq";
import { acquireLock, releaseLock, isLockHeld } from "@/lib/system-lock";
import { canSendNow } from "@/lib/send-limiter";
import { LIMITS, TIMEOUTS } from "@/lib/constants";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false;
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isLockHeld("scrape-global")) {
    return NextResponse.json({ skipped: true, reason: "Scrape still running" });
  }

  const locked = await acquireLock("instant-apply");
  if (!locked) {
    return NextResponse.json({
      skipped: true,
      reason: "Another instant-apply is running",
    });
  }

  try {
    const startTime = Date.now();

    const freshJobs = await prisma.globalJob.findMany({
      where: { isFresh: true, isActive: true },
      take: LIMITS.MATCH_BATCH,
    });

    if (freshJobs.length === 0) {
      await releaseLock("instant-apply");
      return NextResponse.json({ processed: 0, reason: "No fresh jobs" });
    }

    const allSettings = await prisma.userSettings.findMany({
      where: {
        isOnboarded: true,
        accountStatus: "active",
        keywords: { isEmpty: false },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: LIMITS.USERS_BATCH,
    });

    const stats = {
      freshJobs: freshJobs.length,
      users: allSettings.length,
      matched: 0,
      drafted: 0,
      sent: 0,
      skipped: 0,
    };

    for (const rawSettings of allSettings) {
      const settings = decryptSettingsFields(rawSettings);
      const userId = settings.userId;
      const resumes = await prisma.resume.findMany({
        where: { userId, isDeleted: false },
        take: 50,
      });

      if (resumes.length === 0) continue;

      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      const existingJobIds = new Set(
        (
          await prisma.userJob.findMany({
            where: { userId },
            select: { globalJobId: true },
            take: LIMITS.EXISTING_JOB_IDS,
          })
        ).map((j) => j.globalJobId),
      );

      const isFullAuto =
        settings.applicationMode === "FULL_AUTO" &&
        settings.autoApplyEnabled &&
        settings.instantApplyEnabled;

      const isSemiAuto = settings.applicationMode === "SEMI_AUTO";

      const isOutsidePeakHours =
        isFullAuto &&
        settings.peakHoursOnly &&
        settings.timezone &&
        !isDuringPeakHours(settings.timezone);

      let appliedCount = 0;
      let draftedCount = 0;

      for (const freshJob of freshJobs) {
        if (existingJobIds.has(freshJob.id)) continue;

        try {
          const match = computeMatchScore(freshJob, settings, resumes);

          if (match.score < MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
            stats.skipped++;
            continue;
          }

          const userJob = await prisma.userJob.create({
            data: {
              userId,
              globalJobId: freshJob.id,
              stage: "SAVED",
              matchScore: match.score,
              matchReasons: match.reasons,
            },
          });
          stats.matched++;

          // Manual mode: only create UserJob, no drafts
          if (settings.applicationMode === "MANUAL") continue;

          if (match.score < MATCH_THRESHOLDS.AUTO_DRAFT) continue;

          const bestResume = await pickBestResume(userId, freshJob);

          // Find or use cached company email
          let emailResult = freshJob.companyEmail
            ? {
                email: freshJob.companyEmail,
                confidence: "HIGH" as const,
                method: "cached",
              }
            : await findCompanyEmail({
                description: freshJob.description,
                company: freshJob.company,
                sourceUrl: freshJob.sourceUrl,
                applyUrl: freshJob.applyUrl,
                companyUrl: freshJob.companyUrl,
              });

          if (emailResult.email && !freshJob.companyEmail) {
            await prisma.globalJob.update({
              where: { id: freshJob.id },
              data: { companyEmail: emailResult.email },
            });
          }

          const emailContent = await generateInstantEmail(
            freshJob,
            settings,
            bestResume,
          );
          const senderEmail =
            settings.applicationEmail || settings.user.email || "";

          // Determine status based on mode + confidence + score
          let appStatus: "DRAFT" | "READY" = "DRAFT";
          let scheduledSendAt: Date | null = null;

          if (isSemiAuto) {
            appStatus = "DRAFT";
          } else if (isFullAuto && !isOutsidePeakHours) {
            if (
              match.score >= (settings.minMatchScoreForAutoApply || 75) &&
              (emailResult.confidence === "HIGH" ||
                emailResult.confidence === "MEDIUM")
            ) {
              const isDupe = await isDuplicateApplication(userId, {
                title: freshJob.title,
                company: freshJob.company,
              });
              if (isDupe) {
                appStatus = "DRAFT";
              } else if ((settings.instantApplyDelay || 0) > 0) {
                appStatus = "READY";
                scheduledSendAt = new Date(
                  Date.now() + (settings.instantApplyDelay || 5) * 60 * 1000,
                );
              } else {
                appStatus = "READY";
              }
            }
          }

          const application = await prisma.jobApplication.create({
            data: {
              userJobId: userJob.id,
              userId,
              senderEmail,
              recipientEmail: emailResult.email || "",
              subject: emailContent.subject,
              emailBody: emailContent.body,
              coverLetter: emailContent.coverLetter,
              resumeId: bestResume?.id,
              status: appStatus,
              appliedVia: emailResult.email ? "EMAIL" : "MANUAL",
              scheduledSendAt,
              emailConfidence: emailResult.confidence,
            },
          });

          draftedCount++;
          stats.drafted++;

          // Attempt immediate send for FULL_AUTO + instant + no delay
          if (appStatus === "READY" && !scheduledSendAt && isFullAuto) {
            const limitCheck = await canSendNow(userId);
            if (limitCheck.allowed) {
              const sendResult = await sendApplication(application.id);
              if (sendResult.success) {
                appliedCount++;
                stats.sent++;
                await new Promise((r) => setTimeout(r, TIMEOUTS.INSTANT_APPLY_DELAY_MS));
              }
            }
          }

          await prisma.activity.create({
            data: {
              userId,
              userJobId: userJob.id,
              type:
                appStatus === "DRAFT"
                  ? "APPLICATION_PREPARED"
                  : "APPLICATION_SENT",
              description: `Auto: ${freshJob.title} at ${freshJob.company} (${match.score}%, ${emailResult.confidence})`,
            },
          });
        } catch (err) {
          console.error(
            `[InstantApply] Error processing job ${freshJob.id} for user ${userId}:`,
            err,
          );
        }
      }

      // Notify user about new matches
      if (
        (appliedCount > 0 || draftedCount > 0) &&
        settings.emailNotifications
      ) {
        const shouldNotify = await checkNotificationLimit(
          userId,
          settings.notificationFrequency,
        );
        if (shouldNotify) {
          const notifEmail = settings.notificationEmail || settings.user.email;
          if (notifEmail) {
            try {
              await sendNotificationEmail({
                from: `JobPilot <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "notifications@jobpilot.app"}>`,
                to: notifEmail,
                subject: `JobPilot: ${appliedCount > 0 ? `${appliedCount} instant-applied` : ""}${appliedCount > 0 && draftedCount > 0 ? " | " : ""}${draftedCount > 0 ? `${draftedCount} drafts ready` : ""}`,
                html: buildNotificationHTML(
                  settings.user.name || "there",
                  appliedCount,
                  draftedCount,
                ),
              });
            } catch {}
          }
        }
      }
    }

    // Mark all fresh jobs as processed
    await prisma.globalJob.updateMany({
      where: { isFresh: true },
      data: { isFresh: false },
    });

    await prisma.systemLog.create({
      data: {
        type: "apply",
        source: "instant-apply",
        message: `Processed ${stats.freshJobs} jobs for ${stats.users} users: ${stats.matched} matched, ${stats.drafted} drafted, ${stats.sent} sent`,
        metadata: stats,
      },
    });

    await releaseLock("instant-apply");

    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    await releaseLock("instant-apply");
    console.error("Instant apply error:", error);
    return NextResponse.json(
      { error: "Instant apply failed", details: String(error) },
      { status: 500 },
    );
  }
}

async function checkNotificationLimit(
  userId: string,
  frequency: string | null,
): Promise<boolean> {
  const freq = frequency || "hourly";
  if (freq === "off") return false;

  const windowMs =
    freq === "realtime"
      ? 5 * 60 * 1000
      : freq === "daily"
        ? 24 * 60 * 60 * 1000
        : 60 * 60 * 1000;
  const maxPerWindow = freq === "daily" ? 3 : freq === "hourly" ? 1 : 10;

  const recent = await prisma.activity.count({
    where: {
      userId,
      type: "NOTIFICATION_SENT",
      createdAt: { gte: new Date(Date.now() - windowMs) },
    },
  });

  return recent < maxPerWindow;
}

function isDuringPeakHours(timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    const hour = parseInt(formatter.format(new Date()));
    return hour >= 9 && hour < 18;
  } catch {
    return true;
  }
}

const TONE_MAP: Record<string, string> = {
  professional:
    "Write in a polished, professional tone. Be clear and structured.",
  friendly:
    "Write in a warm, approachable tone. Be personable but still professional.",
  confident:
    "Write in a bold, direct tone. Lead with achievements and value you bring.",
  casual:
    "Write in a relaxed, conversational tone. Be natural like messaging a colleague.",
  formal:
    "Write in a traditional, formal business tone. Use structured paragraphs.",
};

async function generateInstantEmail(
  job: {
    title: string;
    company: string;
    location: string | null;
    description: string | null;
    skills: string[];
    jobType: string | null;
  },
  settings: {
    fullName: string | null;
    preferredTone: string | null;
    emailLanguage: string | null;
    customSystemPrompt: string | null;
    customClosing: string | null;
    keywords: string[];
    experienceLevel: string | null;
    education: string | null;
    city: string | null;
    country: string | null;
    includeLinkedin: boolean;
    linkedinUrl: string | null;
    includeGithub: boolean;
    githubUrl: string | null;
    includePortfolio: boolean;
    portfolioUrl: string | null;
    user: { name: string | null };
  },
  bestResume: { content: string | null } | null,
): Promise<{ subject: string; body: string; coverLetter: string | null }> {
  const tone = settings.preferredTone || "professional";
  const lang = settings.emailLanguage || "English";

  const systemPrompt = `You are a job application email writer.

## Style
${TONE_MAP[tone] || TONE_MAP.professional}

## Language
Write the ENTIRE email in ${lang}.

## Rules
1. Keep between 150-250 words
2. No clichés ("I am writing to express my interest")
3. No placeholder brackets — use actual candidate info
4. Mention 2-3 specific qualifications matching the job
5. Include a clear call-to-action
6. End with candidate's name
${settings.customClosing ? `7. Use this closing: "${settings.customClosing}"` : ""}
${settings.customSystemPrompt ? `\n## CUSTOM INSTRUCTIONS\n${settings.customSystemPrompt}\n` : ""}

## Output
Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

  const links: string[] = [];
  if (settings.includeLinkedin && settings.linkedinUrl)
    links.push(`LinkedIn: ${settings.linkedinUrl}`);
  if (settings.includeGithub && settings.githubUrl)
    links.push(`GitHub: ${settings.githubUrl}`);
  if (settings.includePortfolio && settings.portfolioUrl)
    links.push(`Portfolio: ${settings.portfolioUrl}`);

  const userPrompt = `Generate application email:

Job: ${job.title} at ${job.company}
Location: ${job.location || "Not specified"} | Type: ${job.jobType || "Not specified"}
Skills: ${job.skills?.join(", ") || "Not specified"}
Description: ${job.description?.substring(0, 1500) || "N/A"}

Candidate: ${settings.fullName || settings.user?.name || "Candidate"}
Experience: ${settings.experienceLevel || "Not specified"}
Skills: ${settings.keywords?.join(", ") || "Not specified"}
Education: ${settings.education || "Not specified"}
Location: ${[settings.city, settings.country].filter(Boolean).join(", ") || "Not specified"}
${links.length > 0 ? `Links: ${links.join(" | ")}` : ""}

Resume: ${bestResume?.content?.substring(0, 1000) || "Not available"}`;

  const response = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 800,
  });

  let parsed: { subject: string; body: string };
  try {
    parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    parsed = {
      subject: `Application for ${job.title} at ${job.company}`,
      body: response,
    };
  }

  const replacements: Record<string, string> = {
    company: job.company,
    position: job.title,
    name: settings.fullName || settings.user?.name || "",
    location: job.location || "",
  };
  parsed.subject = parsed.subject.replace(
    /\{\{(\w+)\}\}/g,
    (_, k: string) => replacements[k] || `{{${k}}}`,
  );
  parsed.body = parsed.body.replace(
    /\{\{(\w+)\}\}/g,
    (_, k: string) => replacements[k] || `{{${k}}}`,
  );

  let coverLetter: string | null = null;
  try {
    coverLetter = await generateWithGroq(
      "Write a concise cover letter (200 words max). Return ONLY the cover letter text, no JSON.",
      `Job: ${job.title} at ${job.company}. Skills: ${job.skills?.join(", ")}.\nCandidate: ${settings.fullName}, ${settings.keywords?.join(", ")}.\nResume: ${bestResume?.content?.substring(0, 500) || "N/A"}`,
      { temperature: 0.7, max_tokens: 400 },
    );
  } catch {}

  return { subject: parsed.subject, body: parsed.body, coverLetter };
}

function buildNotificationHTML(
  name: string,
  applied: number,
  drafted: number,
): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://jobpilot.vercel.app";
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h1 style="font-size:22px;color:#1e293b;">Hi ${name}!</h1>
    ${applied > 0 ? `<div style="background:#dcfce7;padding:12px 16px;border-radius:8px;margin:12px 0;color:#166534;"><strong>${applied} applications sent instantly</strong></div>` : ""}
    ${drafted > 0 ? `<div style="background:#fef3c7;padding:12px 16px;border-radius:8px;margin:12px 0;color:#92400e;"><strong>${drafted} applications drafted</strong> — review and send when ready</div>` : ""}
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}/applications" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review Applications</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— JobPilot</p>
  </body></html>`;
}
