"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  isDefault: z.boolean().optional().default(false),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  isDefault: z.boolean().optional(),
});

export async function getEmailTemplates() {
  const userId = await getAuthUserId();

  return prisma.emailTemplate.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function createEmailTemplate(rawData: unknown) {
  try {
    const userId = await getAuthUserId();
    const data = createTemplateSchema.parse(rawData);

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!settings) throw new Error("Configure settings first");

    const templateData = {
      userId,
      settingsId: settings.id,
      name: data.name,
      subject: data.subject,
      body: data.body,
      isDefault: data.isDefault ?? false,
    };

    if (data.isDefault) {
      await prisma.$transaction([
        prisma.emailTemplate.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.emailTemplate.create({ data: templateData }),
      ]);
    } else {
      await prisma.emailTemplate.create({ data: templateData });
    }

    revalidatePath("/templates");
    revalidatePath("/settings");
  } catch (error) {
    if (error instanceof Error && error.message === "Configure settings first") throw error;
    if (error instanceof z.ZodError) throw new Error(error.errors[0].message);
    console.error("[createEmailTemplate] Error:", error);
    throw new Error("Failed to create email template.");
  }
}

export async function updateEmailTemplate(id: string, rawData: unknown) {
  try {
    const userId = await getAuthUserId();
    const data = updateTemplateSchema.parse(rawData);

    const template = await prisma.emailTemplate.findFirst({
      where: { id, userId },
    });
    if (!template) throw new Error("Template not found");

    const updateData: { name?: string; subject?: string; body?: string; isDefault?: boolean } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    if (data.isDefault === true) {
      await prisma.$transaction([
        prisma.emailTemplate.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.emailTemplate.update({ where: { id }, data: updateData }),
      ]);
    } else {
      await prisma.emailTemplate.update({ where: { id }, data: updateData });
    }

    revalidatePath("/templates");
    revalidatePath("/settings");
  } catch (error) {
    if (error instanceof Error && error.message === "Template not found") throw error;
    if (error instanceof z.ZodError) throw new Error(error.errors[0].message);
    console.error("[updateEmailTemplate] Error:", error);
    throw new Error("Failed to update email template.");
  }
}

export async function deleteEmailTemplate(id: string) {
  try {
    const userId = await getAuthUserId();

    const template = await prisma.emailTemplate.findFirst({
      where: { id, userId },
    });
    if (!template) throw new Error("Template not found");

    await prisma.emailTemplate.delete({ where: { id } });
    revalidatePath("/templates");
    revalidatePath("/settings");
  } catch (error) {
    if (error instanceof Error && error.message === "Template not found") throw error;
    console.error("[deleteEmailTemplate] Error:", error);
    throw new Error("Failed to delete email template.");
  }
}

const STARTER_TEMPLATES = [
  {
    name: "General Application",
    subject: "Application for {{position}} — {{name}}",
    body: `Dear Hiring Manager,

I am writing to express my interest in the {{position}} role at {{company}}. I believe my experience and skills align well with your requirements.

I have attached my resume for your review. I would welcome the opportunity to discuss how I can contribute to your team.

Best regards,
{{name}}`,
  },
  {
    name: "Technical Role",
    subject: "{{position}} — {{name}}",
    body: `Hello,

I am applying for the {{position}} position at {{company}}. My technical background includes experience with modern web technologies and a strong focus on delivering quality solutions.

I am excited about the opportunity to bring my skills to your team and contribute to your technical goals.

Sincerely,
{{name}}`,
  },
  {
    name: "Startup / Casual",
    subject: "Excited about {{position}} at {{company}}",
    body: `Hey there,

I'm really excited about the {{position}} opportunity at {{company}}! I love what you're building and would love to be part of the team.

I've attached my resume — would love to chat more about how I can help.

Cheers,
{{name}}`,
  },
  {
    name: "Referral Mention",
    subject: "{{position}} at {{company}} — Referred by [Referrer]",
    body: `Dear Hiring Manager,

I was referred to the {{position}} role at {{company}} by [Referrer's name], who thought I would be a great fit for your team.

I am very interested in this opportunity and have attached my resume. I would appreciate the chance to discuss how I can contribute.

Thank you,
{{name}}`,
  },
];

export async function seedStarterTemplates() {
  const userId = await getAuthUserId();

  const existing = await prisma.emailTemplate.count({
    where: { userId },
  });
  if (existing > 0) return;

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!settings) throw new Error("Configure settings first");

  await prisma.emailTemplate.createMany({
    data: STARTER_TEMPLATES.map((t, i) => ({
      userId,
      settingsId: settings.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      isDefault: i === 0,
    })),
  });

  revalidatePath("/templates");
  revalidatePath("/settings");
}
