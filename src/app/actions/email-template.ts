"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  isDefault: z.boolean().default(false),
});

export async function getEmailTemplates() {
  const userId = await getAuthUserId();

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!settings) return [];

  return prisma.emailTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createEmailTemplate(rawData: unknown) {
  const userId = await getAuthUserId();
  const data = templateSchema.parse(rawData);

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!settings) throw new Error("Configure settings first");

  if (data.isDefault) {
    await prisma.emailTemplate.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.emailTemplate.create({
    data: {
      userId,
      settingsId: settings.id,
      name: data.name,
      subject: data.subject,
      body: data.body,
      isDefault: data.isDefault,
    },
  });

  revalidatePath("/settings");
}

export async function updateEmailTemplate(id: string, rawData: unknown) {
  const userId = await getAuthUserId();
  const data = templateSchema.parse(rawData);

  const template = await prisma.emailTemplate.findFirst({
    where: { id, userId },
  });
  if (!template) throw new Error("Template not found");

  if (data.isDefault) {
    await prisma.emailTemplate.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: data.name,
      subject: data.subject,
      body: data.body,
      isDefault: data.isDefault,
    },
  });

  revalidatePath("/settings");
}

export async function deleteEmailTemplate(id: string) {
  const userId = await getAuthUserId();

  const template = await prisma.emailTemplate.findFirst({
    where: { id, userId },
  });
  if (!template) throw new Error("Template not found");

  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/settings");
}
