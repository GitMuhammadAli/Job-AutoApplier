"use server";

import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { decryptSettingsFields } from "@/lib/encryption";
import { generateApplicationEmail } from "@/lib/ai-email-generator";
import { generateCoverLetterFromInput } from "@/lib/ai-cover-letter-generator";
import { generatePitchFromInput } from "@/lib/ai-pitch-generator";
import { pickBestResumeWithTier } from "@/lib/matching/resume-matcher";
import { ensureTailoredResume } from "@/lib/resume/auto-attach";
import { computeAtsCoverageLite, extractJdKeywords } from "@/lib/resume/keyword-coverage";
import { expandKeywordVariants } from "@/lib/resume/keyword-aliases";
import { APPLICATION_EMAIL_ERR } from "@/lib/messages";
import type { GenerateEmailInput } from "@/lib/ai-email-generator";

async function buildEmailInput(
  userId: string,
  userJobId: string,
  overrideResumeId?: string,
): Promise<{
  input: GenerateEmailInput;
  matchedResume: { id: string; name: string; tier: string; reason: string };
  recipientEmail: string;
  senderEmail: string;
}> {
  const userJob = await prisma.userJob.findFirst({
    where: { id: userJobId, userId },
    include: { globalJob: true },
  });
  if (!userJob) throw new Error(APPLICATION_EMAIL_ERR.JOB_NOT_FOUND);

  const rawSettings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!rawSettings) throw new Error(APPLICATION_EMAIL_ERR.NO_SETTINGS);
  const settings = decryptSettingsFields(rawSettings);
  if (!settings.fullName) {
    throw new Error(
      rawSettings.fullName
        ? APPLICATION_EMAIL_ERR.PROFILE_DECRYPT_FAIL
        : APPLICATION_EMAIL_ERR.PROFILE_INCOMPLETE,
    );
  }

  let resumeResult: Awaited<ReturnType<typeof pickBestResumeWithTier>>;

  if (overrideResumeId) {
    const resume = await prisma.resume.findFirst({
      where: { id: overrideResumeId, userId },
      select: {
        id: true, name: true, content: true, isDefault: true,
        fileUrl: true, fileName: true, targetCategories: true,
        detectedSkills: true, updatedAt: true,
      },
    });
    if (!resume) throw new Error(APPLICATION_EMAIL_ERR.SELECTED_RESUME_NOT_FOUND);
    resumeResult = { resume, tier: "fallback" as const, reason: "Manually selected" };
  } else {
    resumeResult = await pickBestResumeWithTier(userId, {
      title: userJob.globalJob.title,
      description: userJob.globalJob.description,
      skills: userJob.globalJob.skills,
      category: userJob.globalJob.category,
      location: userJob.globalJob.location,
    }, settings.resumeMatchMode);
  }

  if (!resumeResult) throw new Error(APPLICATION_EMAIL_ERR.NO_RESUMES_UPLOADED);

  const defaultTemplate = await prisma.emailTemplate.findFirst({
    where: { userId, isDefault: true },
  });

  const input: GenerateEmailInput = {
    job: {
      title: userJob.globalJob.title,
      company: userJob.globalJob.company,
      location: userJob.globalJob.location,
      salary: userJob.globalJob.salary,
      skills: userJob.globalJob.skills,
      description: userJob.globalJob.description,
      source: userJob.globalJob.source,
    },
    profile: {
      fullName: settings.fullName,
      phone: settings.phone,
      experienceLevel: settings.experienceLevel,
      linkedinUrl: settings.linkedinUrl,
      githubUrl: settings.githubUrl,
      portfolioUrl: settings.portfolioUrl,
      includeLinkedin: settings.includeLinkedin,
      includeGithub: settings.includeGithub,
      includePortfolio: settings.includePortfolio,
    },
    resume: {
      name: resumeResult.resume.name,
      content: resumeResult.resume.content,
      detectedSkills: resumeResult.resume.detectedSkills,
    },
    settings: {
      preferredTone: settings.preferredTone,
      emailLanguage: settings.emailLanguage,
      customClosing: settings.customClosing,
      customSystemPrompt: settings.customSystemPrompt,
      defaultSignature: settings.defaultSignature,
    },
    template: defaultTemplate
      ? { subject: defaultTemplate.subject, body: defaultTemplate.body }
      : null,
  };

  // JD ↔ profile coverage — pass to the email writer so it knows which JD
  // keywords are safe to emphasize and which to never claim. Lightweight
  // (no structured profile load needed); just resume.content + skills.
  const jdText = userJob.globalJob.description ?? "";
  if (jdText.trim().length >= 80) {
    const knownSkills = Array.from(
      new Set(
        [
          ...(settings.keywords ?? []),
          ...(resumeResult.resume.detectedSkills ?? []),
        ]
          .map((s) => s.toLowerCase().trim())
          .filter(Boolean),
      ),
    );
    const haystack = [
      ...(settings.keywords ?? []),
      ...(resumeResult.resume.detectedSkills ?? []),
      resumeResult.resume.content ?? "",
    ]
      .join(" \n ")
      .toLowerCase();
    const cov = computeAtsCoverageLite(jdText, haystack, knownSkills);
    if (cov.total > 0) {
      input.jdCoverage = {
        coveredKeywords: extractCoveredFromLite(jdText, haystack, knownSkills),
        missingKeywords: cov.missing,
      };
    }
  }

  return {
    input,
    matchedResume: {
      id: resumeResult.resume.id,
      name: resumeResult.resume.name,
      tier: resumeResult.tier,
      reason: resumeResult.reason,
    },
    recipientEmail: userJob.globalJob.companyEmail || "",
    senderEmail: settings.applicationEmail || settings.smtpUser || "",
  };
}

function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  // RFC 5322 simplified: local@domain.tld
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * computeAtsCoverageLite returns missing keywords but not covered ones —
 * because the use case for the recommendation engine only needed the
 * missing count. For the email writer we want the inverse: which JD
 * keywords the candidate DOES have, so the email can emphasize them.
 * Re-extract here using the same tokenizer + check the haystack.
 */
function extractCoveredFromLite(
  jdText: string,
  haystack: string,
  knownSkills: string[],
): string[] {
  const keywords = extractJdKeywords(jdText).slice(0, 25);
  const haystackLower = haystack.toLowerCase();
  const knownSet = new Set(knownSkills.map((s) => s.toLowerCase().trim()));
  return keywords.filter((kw) => {
    // Aliases must agree with the missing-side check in
    // computeAtsCoverageLite — otherwise a JD keyword like "K8s" would
    // be classified as both covered (matches kubernetes via alias) AND
    // missing (raw lowercase check) and the email prompt would receive
    // contradictory instructions.
    const variants = expandKeywordVariants(kw);
    return variants.some((v) => knownSet.has(v) || haystackLower.includes(v));
  });
}

export async function generateApplication(userJobId: string, resumeId?: string) {
  try {
    const userId = await getAuthUserId();
    const { input, matchedResume, recipientEmail, senderEmail } =
      await buildEmailInput(userId, userJobId, resumeId);

    const generated = await generateApplicationEmail(input, {
      quota: { userId, route: "/actions/application-email/generate" },
    });

    // If an existing draft has a recipient email (manually entered or from a
    // previous enrichment) and the current globalJob has none, keep the old one.
    let finalRecipientEmail = recipientEmail;
    if (!finalRecipientEmail) {
      const existing = await prisma.jobApplication.findUnique({
        where: { userJobId },
        select: { recipientEmail: true },
      });
      if (existing?.recipientEmail) {
        finalRecipientEmail = existing.recipientEmail;
      }
    }

    const application = await prisma.jobApplication.upsert({
      where: { userJobId },
      update: {
        subject: generated.subject,
        emailBody: generated.body,
        resumeId: matchedResume.id,
        status: "DRAFT",
        senderEmail,
        recipientEmail: finalRecipientEmail,
      },
      create: {
        userJobId,
        userId,
        subject: generated.subject,
        emailBody: generated.body,
        coverLetter: generated.coverLetter,
        resumeId: matchedResume.id,
        status: "DRAFT",
        senderEmail,
        recipientEmail: finalRecipientEmail,
        appliedVia: finalRecipientEmail ? "EMAIL" : "MANUAL",
      },
    });

    await prisma.activity.create({
      data: {
        userId,
        userJobId,
        type: "APPLICATION_PREPARED",
        description: `Email draft generated. Resume: ${matchedResume.name} (${matchedResume.tier}: ${matchedResume.reason})`,
      },
    });

    revalidatePath(`/jobs/${userJobId}`);
    revalidatePath("/applications");

    return {
      application,
      matchedResume,
    };
  } catch (error) {
    console.error("[generateApplication]", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate application",
    );
  }
}

export async function regenerateApplication(userJobId: string, resumeId?: string) {
  return generateApplication(userJobId, resumeId);
}

export async function updateApplicationDraft(
  applicationId: string,
  data: {
    subject?: string;
    emailBody?: string;
    coverLetter?: string;
    recipientEmail?: string;
  },
) {
  try {
    const userId = await getAuthUserId();

    if (
      data.recipientEmail !== undefined &&
      !isValidEmail(data.recipientEmail)
    ) {
      throw new Error(APPLICATION_EMAIL_ERR.INVALID_EMAIL);
    }

    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) throw new Error(APPLICATION_EMAIL_ERR.APPLICATION_NOT_FOUND);

    const updated = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.emailBody !== undefined && { emailBody: data.emailBody }),
        ...(data.coverLetter !== undefined && {
          coverLetter: data.coverLetter,
        }),
        ...(data.recipientEmail !== undefined && {
          recipientEmail: data.recipientEmail,
        }),
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/jobs/${app.userJobId}`);
    revalidatePath("/applications");
    return updated;
  } catch (error) {
    console.error("[updateApplicationDraft]", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update application draft",
    );
  }
}

export async function generateCoverLetterAction(userJobId: string) {
  try {
    const userId = await getAuthUserId();
    const { input, matchedResume } = await buildEmailInput(userId, userJobId);

    const coverLetter = await generateCoverLetterFromInput(input);

    await prisma.userJob.update({
      where: { id: userJobId },
      data: { coverLetter },
    });

    const application = await prisma.jobApplication.findUnique({
      where: { userJobId },
    });
    if (application) {
      await prisma.jobApplication.update({
        where: { id: application.id },
        data: { coverLetter },
      });
    }

    await prisma.activity.create({
      data: {
        userId,
        userJobId,
        type: "COVER_LETTER_GENERATED",
        description: `Cover letter generated. Resume: ${matchedResume.name}`,
      },
    });

    revalidatePath(`/jobs/${userJobId}`);
    return coverLetter;
  } catch (error) {
    console.error("[generateCoverLetterAction]", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to generate cover letter",
    );
  }
}

export async function generatePitchAction(userJobId: string) {
  try {
    const userId = await getAuthUserId();
    const { input } = await buildEmailInput(userId, userJobId);
    const pitch = await generatePitchFromInput(input);
    revalidatePath(`/jobs/${userJobId}`);
    return pitch;
  } catch (error) {
    console.error("[generatePitchAction]", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate pitch",
    );
  }
}

export async function generateCoverLetterAndPitchAction(userJobId: string) {
  try {
    const userId = await getAuthUserId();
    const { input, matchedResume } = await buildEmailInput(userId, userJobId);

    const [coverLetter, pitch] = await Promise.all([
      generateCoverLetterFromInput(input),
      generatePitchFromInput(input),
    ]);

    await prisma.userJob.update({
      where: { id: userJobId },
      data: { coverLetter },
    });

    const application = await prisma.jobApplication.findUnique({
      where: { userJobId },
    });
    if (application) {
      await prisma.jobApplication.update({
        where: { id: application.id },
        data: { coverLetter },
      });
    }

    await prisma.activity.create({
      data: {
        userId,
        userJobId,
        type: "COVER_LETTER_GENERATED",
        description: `Cover letter & pitch generated. Resume: ${matchedResume.name}`,
      },
    });

    revalidatePath(`/jobs/${userJobId}`);
    return { coverLetter, pitch };
  } catch (error) {
    console.error("[generateCoverLetterAndPitchAction]", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate content",
    );
  }
}

export async function markAsManuallyApplied(
  userJobId: string,
  data?: { platform?: string; notes?: string },
) {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
      include: { globalJob: true },
    });
    if (!userJob) throw new Error(APPLICATION_EMAIL_ERR.JOB_NOT_FOUND);

    await prisma.userJob.update({
      where: { id: userJobId },
      data: { stage: "APPLIED" },
    });

    const existing = await prisma.jobApplication.findUnique({
      where: { userJobId },
    });
    if (existing) {
      await prisma.jobApplication.update({
        where: { id: existing.id },
        data: { status: "SENT", appliedVia: "MANUAL", sentAt: new Date() },
      });
    } else {
      await prisma.jobApplication.create({
        data: {
          userJobId,
          userId,
          senderEmail: "",
          recipientEmail: "",
          subject: `Applied to ${userJob.globalJob.title || "Unknown"}`,
          emailBody: data?.notes || "Applied manually",
          status: "SENT",
          appliedVia: "MANUAL",
          sentAt: new Date(),
        },
      });
    }

    await prisma.activity.create({
      data: {
        userId,
        userJobId,
        type: "APPLICATION_SENT",
        description: `Manually applied${data?.platform ? ` via ${data.platform}` : ""}`,
      },
    });

    revalidatePath("/applications");
    revalidatePath("/");
    revalidatePath(`/jobs/${userJobId}`);
  } catch (error) {
    console.error("[markAsManuallyApplied]", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to mark as manually applied",
    );
  }
}

/**
 * One-click Tailor & Apply — the single visible-product-win entry point.
 *
 * Called from the JobCard's "Tailor & Apply" button. Does everything in one
 * server roundtrip so the user only sees: click → spinner → land on a
 * fully-prepared application draft to review.
 *
 * Chains:
 *   1. saveGlobalJob   — upserts a UserJob linking user → globalJob, stage=SAVED
 *   2. generateApplication — runs the 4-agent pipeline + email composer,
 *                            creates JobApplication draft with subject + body
 *   3. ensureTailoredResume — runs the resume tailor chain + new keyword
 *                            force-include, generates ResumeGeneration row,
 *                            attaches to the application
 *
 * Each step is idempotent (saveGlobalJob/generateApplication are upserts;
 * ensureTailoredResume short-circuits if already attached) — retries are
 * safe. Resume tailoring failure does NOT block the action; user still gets
 * a draft with the uploaded-PDF fallback resume.
 */
export async function tailorAndPrepareApplication(globalJobId: string): Promise<{
  success: boolean;
  userJobId?: string;
  applicationId?: string;
  resumeGenerationId?: string;
  tailored?: boolean;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();

    // Preflight — surface friendly error BEFORE creating a UserJob so we
    // don't leave a dangling "SAVED" job on the user's kanban with no
    // matching application. Previous behavior: upsert the UserJob first,
    // then throw deep in the email pipeline → user clicked once, ended
    // up with a saved job and an error toast, very confused.
    const [settings, resumeCount] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId }, select: { fullName: true } }),
      prisma.resume.count({ where: { userId, isDeleted: false } }),
    ]);
    if (!settings || !settings.fullName) {
      return { success: false, error: APPLICATION_EMAIL_ERR.NO_SETTINGS };
    }
    if (resumeCount === 0) {
      return { success: false, error: APPLICATION_EMAIL_ERR.NO_RESUMES_UPLOADED };
    }

    // Step 1 — ensure UserJob link exists (or unhide a dismissed one).
    const userJob = await prisma.userJob.upsert({
      where: { userId_globalJobId: { userId, globalJobId } },
      create: { userId, globalJobId, stage: "SAVED" },
      update: { isDismissed: false },
    });

    // Step 2 — generate email + create JobApplication draft.
    // generateApplication is the existing AI-email action; it does its own
    // best-resume pick and creates/updates the draft.
    const { application } = await generateApplication(userJob.id);

    // Step 3 — tailor the resume (best-effort). Uses the new keyword
    // force-include via ensureTailoredResume → auto-attach.ts. Failure here
    // is logged but doesn't fail the apply flow — user keeps the uploaded
    // PDF that generateApplication already matched.
    let resumeGenerationId: string | undefined;
    let tailored = false;
    try {
      const ensured = await ensureTailoredResume(application.id);
      if (ensured) {
        await prisma.jobApplication.update({
          where: { id: application.id },
          data: { resumeGenerationId: ensured.generationId },
        });
        resumeGenerationId = ensured.generationId;
        tailored = ensured.freshlyGenerated;
      }
    } catch (err) {
      console.warn(
        `[tailorAndPrepareApplication] resume tailoring failed for application ${application.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    revalidatePath("/recommended");
    revalidatePath("/applications");
    revalidatePath(`/jobs/${userJob.id}`);

    return {
      success: true,
      userJobId: userJob.id,
      applicationId: application.id,
      resumeGenerationId,
      tailored,
    };
  } catch (error) {
    console.error("[tailorAndPrepareApplication]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to prepare application",
    };
  }
}
