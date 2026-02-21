"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { encryptSettingsFields, decryptSettingsFields } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LIMITS, BANNED_KEYWORDS } from "@/lib/constants";

const keywordSchema = z
  .string()
  .min(LIMITS.MIN_KEYWORD_LENGTH, `Keyword must be at least ${LIMITS.MIN_KEYWORD_LENGTH} characters`)
  .max(LIMITS.MAX_KEYWORD_LENGTH, `Keyword must be at most ${LIMITS.MAX_KEYWORD_LENGTH} characters`)
  .refine(
    (kw) => !BANNED_KEYWORDS.some((b) => kw.toLowerCase().trim() === b),
    { message: "This keyword is not allowed" }
  );

const settingsSchema = z.object({
  // Personal
  fullName: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  // Job Preferences
  keywords: z.array(keywordSchema).max(LIMITS.MAX_KEYWORDS, `Maximum ${LIMITS.MAX_KEYWORDS} keywords allowed`).default([]),
  city: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  salaryCurrency: z.string().default("USD"),
  experienceLevel: z.string().optional().or(z.literal("")),
  education: z.string().optional().or(z.literal("")),
  workType: z.array(z.string()).default([]),
  jobType: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  preferredCategories: z.array(z.string()).default([]),
  preferredPlatforms: z.array(z.string()).default([]),
  // Notifications
  emailNotifications: z.boolean().default(true),
  notificationEmail: z.string().email().optional().or(z.literal("")),
  // Email Provider
  emailProvider: z.string().default("gmail"),
  smtpHost: z.string().optional().or(z.literal("")),
  smtpPort: z.number().nullable().optional(),
  smtpUser: z.string().optional().or(z.literal("")),
  smtpPass: z.string().optional().or(z.literal("")),
  // Resume Matching
  resumeMatchMode: z.string().default("smart"),
  // Application Automation
  applicationEmail: z.string().email().optional().or(z.literal("")),
  applicationMode: z
    .enum(["MANUAL", "SEMI_AUTO", "FULL_AUTO", "INSTANT"])
    .default("SEMI_AUTO"),
  autoApplyEnabled: z.boolean().default(false),
  maxAutoApplyPerDay: z.number().min(1).max(50).default(10),
  minMatchScoreForAutoApply: z.number().min(0).max(100).default(75),
  defaultSignature: z.string().max(1000).optional().or(z.literal("")),
  // AI Customization
  customSystemPrompt: z.string().max(2000).optional().or(z.literal("")),
  preferredTone: z.string().default("professional"),
  emailLanguage: z.string().default("English"),
  includeLinkedin: z.boolean().default(true),
  includeGithub: z.boolean().default(true),
  includePortfolio: z.boolean().default(true),
  customClosing: z.string().max(100).optional().or(z.literal("")),
  // Speed & Instant Apply
  instantApplyEnabled: z.boolean().default(false),
  priorityPlatforms: z.array(z.string()).default(["rozee"]),
  peakHoursOnly: z.boolean().default(false),
  timezone: z.string().default("Asia/Karachi"),
  accountStatus: z.string().default("active"),
  notificationFrequency: z.string().default("hourly"),
  instantApplyDelay: z.number().min(0).max(30).default(5),
  // Sending Safety
  sendDelaySeconds: z.number().min(30).max(600).default(120),
  maxSendsPerHour: z.number().min(1).max(30).default(8),
  maxSendsPerDay: z.number().min(1).max(100).default(20),
  cooldownMinutes: z.number().min(5).max(120).default(30),
  bouncePauseHours: z.number().min(1).max(72).default(24),
});

export async function getSettings() {
  const userId = await getAuthUserId();

  let settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId },
    });
  }

  return decryptSettingsFields(settings);
}

export async function saveSettings(rawData: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const data = settingsSchema.parse(rawData);

    const nulled = {
      ...data,
      fullName: data.fullName || null,
      phone: data.phone || null,
      linkedinUrl: data.linkedinUrl || null,
      portfolioUrl: data.portfolioUrl || null,
      githubUrl: data.githubUrl || null,
      city: data.city || null,
      country: data.country || null,
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      experienceLevel: data.experienceLevel || null,
      education: data.education || null,
      notificationEmail: data.notificationEmail || null,
      applicationEmail: data.applicationEmail || null,
      defaultSignature: data.defaultSignature || null,
      customSystemPrompt: data.customSystemPrompt || null,
      customClosing: data.customClosing || null,
      timezone: data.timezone || null,
      smtpHost: data.smtpHost || null,
      smtpPort: data.smtpPort ?? null,
      smtpUser: data.smtpUser || null,
      smtpPass: data.smtpPass ? data.smtpPass.replace(/\s/g, "") || null : null,
      emailProvider: data.emailProvider || "gmail",
      resumeMatchMode: data.resumeMatchMode || "smart",
      accountStatus: data.accountStatus || "active",
      notificationFrequency: data.notificationFrequency || "hourly",
      instantApplyDelay: data.instantApplyDelay ?? 5,
      sendDelaySeconds: data.sendDelaySeconds ?? 120,
      maxSendsPerHour: data.maxSendsPerHour ?? 8,
      maxSendsPerDay: data.maxSendsPerDay ?? 20,
      cooldownMinutes: data.cooldownMinutes ?? 30,
      bouncePauseHours: data.bouncePauseHours ?? 24,
    };

    const cleaned = encryptSettingsFields(nulled);

    await prisma.userSettings.upsert({
      where: { userId },
      update: cleaned,
      create: { userId, ...cleaned },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/recommended");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const field = error.issues[0]?.path?.join(".") || "input";
      return { success: false, error: `Invalid ${field}: ${error.issues[0]?.message}` };
    }
    console.error("[saveSettings] Error:", error);
    return { success: false, error: "Failed to save settings" };
  }
}

export async function completeOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    await prisma.userSettings.update({
      where: { userId },
      data: { isOnboarded: true },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[completeOnboarding] Error:", error);
    return { success: false, error: "Failed to complete onboarding" };
  }
}

export async function deleteAccount(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();

    await prisma.$transaction(async (tx) => {
      await tx.activity.deleteMany({ where: { userId } });
      await tx.jobApplication.deleteMany({ where: { userId } });
      await tx.userJob.deleteMany({ where: { userId } });
      await tx.resume.deleteMany({ where: { userId } });
      await tx.emailTemplate.deleteMany({ where: { userId } });
      await tx.userSettings.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  } catch (error) {
    console.error("[deleteAccount] Failed:", error);
    return {
      success: false,
      error: "Failed to delete account. Please try again.",
    };
  }
}
