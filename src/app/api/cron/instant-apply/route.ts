import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/matching/score-engine";
import { pickBestResume } from "@/lib/matching/resume-matcher";
import { findCompanyEmail } from "@/lib/email-extractor";
import { isDuplicateApplication } from "@/lib/duplicate-checker";
import { getTransporterForUser, sendApplicationEmail, sendNotificationEmail, formatCoverLetterHtml } from "@/lib/email";
import { generateWithGroq } from "@/lib/groq";
import { acquireLock, releaseLock, isLockHeld } from "@/lib/system-lock";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
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
    return NextResponse.json({ skipped: true, reason: "Another instant-apply is running" });
  }

  try {
    // Phase 1: Retry previously failed applications (up to 3 retries)
    const retryApps = await prisma.jobApplication.findMany({
      where: {
        status: "READY",
        retryCount: { lt: 3 },
        scheduledSendAt: { lte: new Date() },
      },
      include: {
        userJob: { include: { globalJob: true } },
        resume: true,
        user: { select: { id: true } },
      },
      take: 10,
    });

    let retried = 0;
    for (const app of retryApps) {
      try {
        const settings = await prisma.userSettings.findUnique({ where: { userId: app.userId } });
        if (!settings || settings.accountStatus !== "active") continue;

        const transporter = getTransporterForUser(settings);
        const htmlBody = formatCoverLetterHtml(app.emailBody, settings.defaultSignature);

        const result = await sendApplicationEmail(
          {
            from: `${settings.fullName || "Applicant"} <${app.senderEmail}>`,
            to: app.recipientEmail,
            subject: app.subject,
            html: htmlBody,
            replyTo: app.senderEmail,
          },
          transporter
        );

        if (result.success) {
          await prisma.$transaction([
            prisma.jobApplication.update({
              where: { id: app.id },
              data: { status: "SENT", sentAt: new Date(), appliedVia: "EMAIL" },
            }),
            prisma.userJob.update({
              where: { id: app.userJobId },
              data: { stage: "APPLIED" },
            }),
          ]);
          retried++;
        } else {
          await prisma.jobApplication.update({
            where: { id: app.id },
            data: {
              retryCount: { increment: 1 },
              errorMessage: result.error,
              status: app.retryCount >= 2 ? "FAILED" : "READY",
            },
          });
        }
      } catch {
        await prisma.jobApplication.update({
          where: { id: app.id },
          data: { retryCount: { increment: 1 } },
        }).catch(() => {});
      }
    }

    // Phase 2: Send scheduled applications (delayed auto-send)
    const scheduledApps = await prisma.jobApplication.findMany({
      where: {
        status: "READY",
        scheduledSendAt: { lte: new Date() },
        retryCount: 0,
      },
      include: {
        userJob: { include: { globalJob: true } },
        resume: true,
      },
      take: 20,
    });

    let scheduledSent = 0;
    for (const app of scheduledApps) {
      try {
        const settings = await prisma.userSettings.findUnique({ where: { userId: app.userId } });
        if (!settings || settings.accountStatus !== "active") continue;

        const transporter = getTransporterForUser(settings);
        const htmlBody = formatCoverLetterHtml(app.emailBody, settings.defaultSignature);

        const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
        if (app.resume?.fileUrl) {
          try {
            const res = await fetch(app.resume.fileUrl);
            attachments.push({
              filename: app.resume.fileName || "resume.pdf",
              content: Buffer.from(await res.arrayBuffer()),
              contentType: "application/pdf",
            });
          } catch {}
        }

        const result = await sendApplicationEmail(
          {
            from: `${settings.fullName || "Applicant"} <${app.senderEmail}>`,
            to: app.recipientEmail,
            subject: app.subject,
            html: htmlBody,
            replyTo: app.senderEmail,
            attachments: attachments.length > 0 ? attachments : undefined,
          },
          transporter
        );

        if (result.success) {
          await prisma.$transaction([
            prisma.jobApplication.update({
              where: { id: app.id },
              data: { status: "SENT", sentAt: new Date(), appliedVia: "EMAIL" },
            }),
            prisma.userJob.update({
              where: { id: app.userJobId },
              data: { stage: "APPLIED" },
            }),
            prisma.activity.create({
              data: {
                userJobId: app.userJobId,
                userId: app.userId,
                type: "APPLICATION_SENT",
                description: `Scheduled send completed | To: ${app.recipientEmail}`,
              },
            }),
          ]);
          scheduledSent++;
        } else {
          await prisma.jobApplication.update({
            where: { id: app.id },
            data: { retryCount: { increment: 1 }, errorMessage: result.error },
          });
        }
      } catch {}
    }

    // Phase 3: Process fresh jobs
    const freshJobs = await prisma.globalJob.findMany({
      where: { isFresh: true, isActive: true },
    });

    if (freshJobs.length === 0) {
      await releaseLock("instant-apply");
      return NextResponse.json({
        message: "No fresh jobs",
        retried,
        scheduledSent,
      });
    }

    const allSettings = await prisma.userSettings.findMany({
      where: { isOnboarded: true, accountStatus: "active" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const results: { userId: string; applied: number; drafted: number; skipped: number }[] = [];

    for (const settings of allSettings) {
      const userId = settings.userId;
      const resumes = await prisma.resume.findMany({
        where: { userId, isDeleted: false },
        select: { id: true, name: true, content: true, isDefault: true },
      });

      const isInstantApply =
        settings.instantApplyEnabled &&
        settings.autoApplyEnabled &&
        settings.applicationMode === "FULL_AUTO";

      const isOutsidePeakHours =
        isInstantApply &&
        settings.peakHoursOnly &&
        settings.timezone &&
        !isDuringPeakHours(settings.timezone);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await prisma.jobApplication.count({
        where: { userId, status: "SENT", sentAt: { gte: todayStart } },
      });
      const remainingToday = (settings.maxAutoApplyPerDay || 10) - todayCount;

      const existingJobIds = new Set(
        (await prisma.userJob.findMany({
          where: { userId },
          select: { globalJobId: true },
        })).map((j) => j.globalJobId)
      );

      let applied = 0;
      let drafted = 0;
      let skipped = 0;
      const delay = settings.instantApplyDelay ?? 5;

      for (const freshJob of freshJobs) {
        if (existingJobIds.has(freshJob.id)) continue;

        const match = computeMatchScore(freshJob, settings, resumes);

        if (match.score < 30) {
          skipped++;
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

        if (
          isInstantApply &&
          !isOutsidePeakHours &&
          match.score >= (settings.minMatchScoreForAutoApply || 75) &&
          applied < remainingToday
        ) {
          const isDuplicate = await isDuplicateApplication(userId, {
            title: freshJob.title,
            company: freshJob.company,
          });
          if (isDuplicate) {
            skipped++;
            continue;
          }

          const emailResult = freshJob.companyEmail
            ? { email: freshJob.companyEmail, confidence: "HIGH" as const, method: "stored" }
            : findCompanyEmail(freshJob.description, freshJob.companyUrl, freshJob.company);

          if (emailResult?.email) {
            if (!freshJob.companyEmail && emailResult.email) {
              await prisma.globalJob.update({
                where: { id: freshJob.id },
                data: { companyEmail: emailResult.email },
              });
            }

            try {
              const bestResume = await pickBestResume(userId, freshJob);
              const emailContent = await generateInstantEmail(freshJob, settings, bestResume);
              const senderEmail = settings.applicationEmail || settings.user.email || "";

              if (delay === 0 && (emailResult.confidence === "HIGH" || emailResult.confidence === "MEDIUM")) {
                // Immediate send
                const application = await prisma.jobApplication.create({
                  data: {
                    userJobId: userJob.id,
                    userId,
                    senderEmail,
                    recipientEmail: emailResult.email,
                    subject: emailContent.subject,
                    emailBody: emailContent.body,
                    resumeId: bestResume?.id,
                    coverLetter: emailContent.coverLetter,
                    status: "SENDING",
                    emailConfidence: emailResult.confidence,
                  },
                });

                const htmlBody = formatCoverLetterHtml(emailContent.body, settings.defaultSignature);
                const transporter = getTransporterForUser(settings);

                const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
                if (bestResume?.fileUrl) {
                  try {
                    const res = await fetch(bestResume.fileUrl);
                    attachments.push({
                      filename: bestResume.fileName || "resume.pdf",
                      content: Buffer.from(await res.arrayBuffer()),
                      contentType: "application/pdf",
                    });
                  } catch {}
                }

                const sendResult = await sendApplicationEmail(
                  {
                    from: `${settings.fullName || settings.user.name || "Applicant"} <${senderEmail}>`,
                    to: emailResult.email,
                    subject: emailContent.subject,
                    html: htmlBody,
                    replyTo: senderEmail,
                    attachments: attachments.length > 0 ? attachments : undefined,
                  },
                  transporter
                );

                if (sendResult.success) {
                  await prisma.$transaction([
                    prisma.jobApplication.update({
                      where: { id: application.id },
                      data: { status: "SENT", sentAt: new Date(), appliedVia: "EMAIL" },
                    }),
                    prisma.userJob.update({
                      where: { id: userJob.id },
                      data: { stage: "APPLIED" },
                    }),
                    prisma.activity.create({
                      data: {
                        userJobId: userJob.id,
                        userId,
                        type: "APPLICATION_SENT",
                        description: `Instant-applied | Match: ${match.score}% | To: ${emailResult.email}`,
                      },
                    }),
                  ]);
                  applied++;
                  await new Promise((r) => setTimeout(r, 1500));
                } else {
                  // Retry mechanism — keep as READY instead of FAILED
                  await prisma.jobApplication.update({
                    where: { id: application.id },
                    data: {
                      status: "READY",
                      errorMessage: sendResult.error,
                      scheduledSendAt: new Date(Date.now() + 5 * 60 * 1000),
                    },
                  });
                  drafted++;
                }
              } else {
                // Delayed send or low confidence — schedule for later
                const scheduledAt = delay > 0
                  ? new Date(Date.now() + delay * 60 * 1000)
                  : null;

                await prisma.jobApplication.create({
                  data: {
                    userJobId: userJob.id,
                    userId,
                    senderEmail,
                    recipientEmail: emailResult.email,
                    subject: emailContent.subject,
                    emailBody: emailContent.body,
                    resumeId: bestResume?.id,
                    coverLetter: emailContent.coverLetter,
                    status: scheduledAt ? "READY" : "DRAFT",
                    emailConfidence: emailResult.confidence,
                    scheduledSendAt: scheduledAt,
                  },
                });
                drafted++;
              }
              continue;
            } catch (error) {
              console.error(`[InstantApply] Send failed for ${freshJob.id}:`, error);
            }
          }
        }

        // Draft path
        if (match.score >= 50) {
          try {
            const bestResume = await pickBestResume(userId, freshJob);
            const emailContent = await generateInstantEmail(freshJob, settings, bestResume);

            await prisma.jobApplication.create({
              data: {
                userJobId: userJob.id,
                userId,
                senderEmail: settings.applicationEmail || settings.user.email || "",
                recipientEmail: freshJob.companyEmail || "",
                subject: emailContent.subject,
                emailBody: emailContent.body,
                resumeId: bestResume?.id,
                coverLetter: emailContent.coverLetter,
                status: "DRAFT",
              },
            });
            drafted++;
          } catch (error) {
            console.error(`[InstantApply] Draft failed for ${freshJob.id}:`, error);
          }
        }
      }

      results.push({ userId, applied, drafted, skipped });

      if ((applied > 0 || drafted > 0) && settings.emailNotifications) {
        const shouldNotify = await checkNotificationLimit(userId, settings.notificationFrequency);
        if (shouldNotify) {
          const notifEmail = settings.notificationEmail || settings.user.email;
          if (notifEmail) {
            try {
              await sendNotificationEmail({
                from: `JobPilot <${process.env.NOTIFICATION_EMAIL || "noreply@jobpilot.app"}>`,
                to: notifEmail,
                subject: `JobPilot: ${applied > 0 ? `${applied} instant-applied` : ""}${applied > 0 && drafted > 0 ? " | " : ""}${drafted > 0 ? `${drafted} drafts ready` : ""}`,
                html: buildNotificationHTML(settings.user.name || "there", applied, drafted),
              });
              await prisma.activity.create({
                data: {
                  userJobId: (await prisma.userJob.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }))?.id || "",
                  userId,
                  type: "NOTIFICATION_SENT",
                  description: `Notification: ${applied} applied, ${drafted} drafted`,
                },
              }).catch(() => {});
            } catch {}
          }
        }
      }
    }

    await prisma.globalJob.updateMany({
      where: { isFresh: true },
      data: { isFresh: false },
    });

    await prisma.systemLog.create({
      data: {
        type: "instant-apply",
        message: `Processed ${freshJobs.length} fresh jobs for ${allSettings.length} users`,
        metadata: { freshJobs: freshJobs.length, users: allSettings.length, results, retried, scheduledSent },
      },
    });

    await releaseLock("instant-apply");

    return NextResponse.json({
      success: true,
      freshJobsProcessed: freshJobs.length,
      retried,
      scheduledSent,
      results,
    });
  } catch (error) {
    await releaseLock("instant-apply");
    console.error("Instant apply error:", error);
    return NextResponse.json(
      { error: "Instant apply failed", details: String(error) },
      { status: 500 }
    );
  }
}

async function checkNotificationLimit(userId: string, frequency: string | null): Promise<boolean> {
  const freq = frequency || "hourly";
  if (freq === "off") return false;

  const windowMs = freq === "realtime" ? 5 * 60 * 1000 : freq === "daily" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
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
  professional: "Write in a polished, professional tone. Be clear and structured.",
  friendly: "Write in a warm, approachable tone. Be personable but still professional.",
  confident: "Write in a bold, direct tone. Lead with achievements and value you bring.",
  casual: "Write in a relaxed, conversational tone. Be natural like messaging a colleague.",
  formal: "Write in a traditional, formal business tone. Use structured paragraphs.",
};

async function generateInstantEmail(
  job: { title: string; company: string; location: string | null; description: string | null; skills: string[]; jobType: string | null },
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
  bestResume: { content: string | null } | null
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
  if (settings.includeLinkedin && settings.linkedinUrl) links.push(`LinkedIn: ${settings.linkedinUrl}`);
  if (settings.includeGithub && settings.githubUrl) links.push(`GitHub: ${settings.githubUrl}`);
  if (settings.includePortfolio && settings.portfolioUrl) links.push(`Portfolio: ${settings.portfolioUrl}`);

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
    parsed = { subject: `Application for ${job.title} at ${job.company}`, body: response };
  }

  const replacements: Record<string, string> = {
    company: job.company,
    position: job.title,
    name: settings.fullName || settings.user?.name || "",
    location: job.location || "",
  };
  parsed.subject = parsed.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => replacements[k] || `{{${k}}}`);
  parsed.body = parsed.body.replace(/\{\{(\w+)\}\}/g, (_, k) => replacements[k] || `{{${k}}}`);

  let coverLetter: string | null = null;
  try {
    coverLetter = await generateWithGroq(
      "Write a concise cover letter (200 words max). Return ONLY the cover letter text, no JSON.",
      `Job: ${job.title} at ${job.company}. Skills: ${job.skills?.join(", ")}.\nCandidate: ${settings.fullName}, ${settings.keywords?.join(", ")}.\nResume: ${bestResume?.content?.substring(0, 500) || "N/A"}`,
      { temperature: 0.7, max_tokens: 400 }
    );
  } catch {}

  return { subject: parsed.subject, body: parsed.body, coverLetter };
}

function buildNotificationHTML(name: string, applied: number, drafted: number): string {
  const appUrl = process.env.NEXTAUTH_URL || "https://jobpilot.vercel.app";
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h1 style="font-size:22px;color:#1e293b;">Hi ${name}!</h1>
    ${applied > 0 ? `<div style="background:#dcfce7;padding:12px 16px;border-radius:8px;margin:12px 0;color:#166534;">⚡ <strong>${applied} applications sent instantly</strong></div>` : ""}
    ${drafted > 0 ? `<div style="background:#fef3c7;padding:12px 16px;border-radius:8px;margin:12px 0;color:#92400e;">📝 <strong>${drafted} applications drafted</strong> — review and send when ready</div>` : ""}
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review Applications →</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— JobPilot</p>
  </body></html>`;
}
