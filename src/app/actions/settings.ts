"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const userId = await getAuthUserId();

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    const created = await prisma.userSettings.create({
      data: { userId },
    });
    return created;
  }

  return settings;
}

export async function updateSettings(data: {
  dailyTarget?: number;
  ghostDays?: number;
  staleDays?: number;
  followUpDays?: number;
  emailNotifications?: boolean;
  timezone?: string;
  searchKeywords?: string;
  searchLocation?: string;
  experienceLevel?: string;
  skills?: string;
  jobCategories?: string;
  educationLevel?: string;
  languages?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryCurrency?: string;
  preferredWorkType?: string;
  preferredPlatforms?: string;
}) {
  const userId = await getAuthUserId();

  await prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  revalidatePath("/settings");
  return { success: true };
}
