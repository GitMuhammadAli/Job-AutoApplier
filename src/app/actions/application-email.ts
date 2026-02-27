"use server";

import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { decryptSettingsFields } from "@/lib/encryption";
import { generateApplicationEmail } from "@/lib/ai-email-generator";
import { generateCoverLetterFromInput } from "@/lib/ai-cover-letter-generator";
import { generatePitchFromInput } from "@/lib/ai-pitch-generator";
import { pickBestResumeWithTier } from "@/lib/matching/resume-matcher";
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
  if (!userJob) throw new Error("Job not found");

  const rawSettings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!rawSettings) throw new Error("Complete your profile in Settings first");
  const settings = decryptSettingsFields(rawSettings);
  if (!settings.fullName) {
    throw new Error(
      rawSettings.fullName
        ? "Could not decrypt your profile data — contact support or re-save your settings"
        : "Complete your profile in Settings first"
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
    if (!resume) throw new Error("Selected resume not found");
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

  if (!resumeResult) throw new Error("Upload at least one resume first");

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

export async function generateApplication(userJobId: string, resumeId?: string) {
  try {
    const userId = await getAuthUserId();
    const { input, matchedResume, recipientEmail, senderEmail } =
      await buildEmailInput(userId, userJobId, resumeId);

    const generated = await generateApplicationEmail(input);

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
      throw new Error("Invalid email address");
    }

    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) throw new Error("Application not found");

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
    if (!userJob) throw new Error("Job not found");

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
