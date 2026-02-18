import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/matching/score-engine";
import { pickBestResume } from "@/lib/matching/resume-matcher";
import { extractCompanyEmail } from "@/lib/email/extract-company-email";
import { generateWithGroq } from "@/lib/groq";
import { sendEmail, formatCoverLetterHtml } from "@/lib/email/sender";

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

  try {
    const freshJobs = await prisma.globalJob.findMany({
      where: { isFresh: true, isActive: true },
    });

    if (freshJobs.length === 0) {
      return NextResponse.json({ message: "No fresh jobs to process" });
    }

    const allSettings = await prisma.userSettings.findMany({
      where: { isOnboarded: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const results: { userId: string; applied: number; drafted: number; skipped: number }[] = [];

    for (const settings of allSettings) {
      const userId = settings.userId;
      const resumes = await prisma.resume.findMany({
        where: { userId },
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

        // ═══ INSTANT APPLY PATH ═══
        if (
          isInstantApply &&
          !isOutsidePeakHours &&
          match.score >= (settings.minMatchScoreForAutoApply || 75) &&
          applied < remainingToday
        ) {
          let recipientEmail = freshJob.companyEmail;
          if (!recipientEmail) {
            recipientEmail = extractCompanyEmail(
              freshJob.description,
              freshJob.companyUrl,
              freshJob.company
            );
            if (recipientEmail) {
              await prisma.globalJob.update({
                where: { id: freshJob.id },
                data: { companyEmail: recipientEmail },
              });
            }
          }

          if (recipientEmail) {
            try {
              const bestResume = await pickBestResume(userId, freshJob);
              const emailContent = await generateInstantEmail(freshJob, settings, bestResume);
              const senderEmail = settings.applicationEmail || settings.user.email || "";

              const application = await prisma.jobApplication.create({
                data: {
                  userJobId: userJob.id,
                  userId,
                  senderEmail,
                  recipientEmail,
                  subject: emailContent.subject,
                  emailBody: emailContent.body,
                  resumeId: bestResume?.id,
                  coverLetter: emailContent.coverLetter,
                  status: "SENDING",
                },
              });

              const htmlBody = formatCoverLetterHtml(emailContent.body, settings.defaultSignature);

              await sendEmail({
                from: `${settings.fullName || settings.user.name || "Applicant"} <${senderEmail}>`,
                to: recipientEmail,
                subject: emailContent.subject,
                html: htmlBody,
                replyTo: senderEmail,
              });

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
                    description: `Instant-applied | Match: ${match.score}% | To: ${recipientEmail}`,
                  },
                }),
              ]);

              applied++;
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            } catch (error) {
              console.error(`[InstantApply] Send failed for ${freshJob.id}:`, error);
            }
          }
        }

        // ═══ DRAFT PATH ═══
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
        const notifEmail = settings.notificationEmail || settings.user.email;
        if (notifEmail) {
          try {
            await sendEmail({
              from: `JobPilot <${process.env.NOTIFICATION_EMAIL || "noreply@jobpilot.app"}>`,
              to: notifEmail,
              subject: `JobPilot: ${applied > 0 ? `${applied} instant-applied` : ""}${applied > 0 && drafted > 0 ? " | " : ""}${drafted > 0 ? `${drafted} drafts ready` : ""}`,
              html: buildNotificationHTML(settings.user.name || "there", applied, drafted),
            });
          } catch {}
        }
      }
    }

    await prisma.globalJob.updateMany({
      where: { isFresh: true },
      data: { isFresh: false },
    });

    return NextResponse.json({
      success: true,
      freshJobsProcessed: freshJobs.length,
      results,
    });
  } catch (error) {
    console.error("Instant apply error:", error);
    return NextResponse.json(
      { error: "Instant apply failed", details: String(error) },
      { status: 500 }
    );
  }
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
    ${applied > 0 ? `<div style="background:#dcfce7;padding:12px 16px;border-radius:8px;margin:12px 0;color:#166534;">⚡ <strong>${applied} applications sent instantly</strong> — you're one of the first applicants!</div>` : ""}
    ${drafted > 0 ? `<div style="background:#fef3c7;padding:12px 16px;border-radius:8px;margin:12px 0;color:#92400e;">📝 <strong>${drafted} applications drafted</strong> — review and send when ready</div>` : ""}
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review Applications →</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">— JobPilot</p>
  </body></html>`;
}
