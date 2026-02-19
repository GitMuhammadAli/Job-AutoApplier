"use server";

import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateApplicationEmail } from "@/lib/ai-email-generator";
import { generateCoverLetterFromInput } from "@/lib/ai-cover-letter-generator";
import { pickBestResumeWithTier } from "@/lib/matching/resume-matcher";
import type { GenerateEmailInput } from "@/lib/ai-email-generator";

async function buildEmailInput(
  userId: string,
  userJobId: string
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

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.fullName)
    throw new Error("Complete your profile in Settings first");

  const resumeResult = await pickBestResumeWithTier(userId, {
    title: userJob.globalJob.title,
    description: userJob.globalJob.description,
    skills: userJob.globalJob.skills,
    category: userJob.globalJob.category,
    location: userJob.globalJob.location,
  });

  if (!resumeResult)
    throw new Error("Upload at least one resume first");

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
    },
    profile: {
      fullName: settings.fullName,
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

export async function generateApplication(userJobId: string) {
  const userId = await getAuthUserId();
  const { input, matchedResume, recipientEmail, senderEmail } =
    await buildEmailInput(userId, userJobId);

  const generated = await generateApplicationEmail(input);

  const application = await prisma.jobApplication.upsert({
    where: { userJobId },
    update: {
      subject: generated.subject,
      emailBody: generated.body,
      coverLetter: generated.coverLetter,
      resumeId: matchedResume.id,
      status: "DRAFT",
      senderEmail,
      recipientEmail,
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
      recipientEmail,
      appliedVia: recipientEmail ? "EMAIL" : "MANUAL",
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
}

export async function regenerateApplication(userJobId: string) {
  return generateApplication(userJobId);
}

export async function updateApplicationDraft(
  applicationId: string,
  data: {
    subject?: string;
    emailBody?: string;
    coverLetter?: string;
    recipientEmail?: string;
  }
) {
  const userId = await getAuthUserId();

  const app = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
  });
  if (!app) throw new Error("Application not found");

  return prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.emailBody !== undefined && { emailBody: data.emailBody }),
      ...(data.coverLetter !== undefined && { coverLetter: data.coverLetter }),
      ...(data.recipientEmail !== undefined && {
        recipientEmail: data.recipientEmail,
      }),
      updatedAt: new Date(),
    },
  });
}

export async function generateCoverLetterAction(userJobId: string) {
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
}

export async function markAsManuallyApplied(
  userJobId: string,
  data?: { platform?: string; notes?: string }
) {
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
}
