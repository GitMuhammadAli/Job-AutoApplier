"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const settingsSchema = z.object({
  // Personal
  fullName: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  // Job Preferences
  keywords: z.array(z.string()).default([]),
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
  // Application Automation
  applicationEmail: z.string().email().optional().or(z.literal("")),
  applicationMode: z.enum(["SEMI_AUTO", "FULL_AUTO"]).default("SEMI_AUTO"),
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

  return settings;
}

export async function saveSettings(rawData: unknown) {
  const userId = await getAuthUserId();
  const data = settingsSchema.parse(rawData);

  const cleaned = {
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
  };

  const result = await prisma.userSettings.upsert({
    where: { userId },
    update: cleaned,
    create: { userId, ...cleaned },
  });

  revalidatePath("/settings");
  return result;
}

export async function completeOnboarding() {
  const userId = await getAuthUserId();

  await prisma.userSettings.update({
    where: { userId },
    data: { isOnboarded: true },
  });

  revalidatePath("/");
}
