"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const DEMO_USER_EMAIL = "ali@demo.com";

async function getDemoUserId(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) throw new Error("Demo user not found");
  return user.id;
}

export async function getSettings() {
  const userId = await getDemoUserId();

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
  const userId = await getDemoUserId();

  await prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  revalidatePath("/settings");
  return { success: true };
}
