"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { extractSkillsFromContent } from "@/lib/skill-extractor";
import { z } from "zod";

const resumeNameSchema = z.string().min(1, "Name is required").max(200, "Name too long");

export async function getResumeCount(): Promise<number> {
  try {
    const userId = await getAuthUserId();
    return prisma.resume.count({ where: { userId, isDeleted: false } });
  } catch (error) {
    console.error("[getResumeCount]", error);
    return 0;
  }
}

export async function getResumesWithStats() {
  try {
    const userId = await getAuthUserId();

    const resumes = await prisma.resume.findMany({
      where: { userId, isDeleted: false },
      include: {
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return resumes.map((r) => ({
      id: r.id,
      name: r.name,
      fileName: r.fileName,
      fileUrl: r.fileUrl,
      fileType: r.fileType,
      content: r.content,
      isDefault: r.isDefault,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      applicationCount: r._count.applications,
      targetCategories: r.targetCategories,
    }));
  } catch (error) {
    console.error("[getResumesWithStats]", error);
    throw new Error("Failed to load resumes");
  }
}

export async function createResume(name: string, fileUrl?: string, content?: string) {
  try {
    const userId = await getAuthUserId();
    const cleanName = resumeNameSchema.parse(name.trim());

    if (fileUrl && fileUrl.length > 2000) throw new Error("File URL too long");

    await prisma.resume.create({
      data: {
        name: cleanName,
        fileUrl: fileUrl || null,
        content: content || null,
        userId,
      },
    });

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error(error.errors[0].message);
    if (error instanceof Error && error.message.includes("too")) throw error;
    console.error("[createResume]", error);
    throw new Error("Failed to create resume");
  }
}

export async function updateResume(
  id: string,
  data: { name?: string; fileUrl?: string; content?: string; isDefault?: boolean },
) {
  try {
    const userId = await getAuthUserId();

    if (data.name !== undefined) resumeNameSchema.parse(data.name.trim());

    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) throw new Error("Resume not found");

    if (data.isDefault) {
      await prisma.resume.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    await prisma.resume.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl || null }),
        ...(data.content !== undefined && { content: data.content || null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error(error.errors[0].message);
    if (error instanceof Error && error.message === "Resume not found") throw error;
    console.error("[updateResume]", error);
    throw new Error("Failed to update resume");
  }
}

export async function deleteResume(id: string) {
  try {
    const userId = await getAuthUserId();

    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) throw new Error("Resume not found");

    await prisma.resume.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Resume not found") throw error;
    console.error("[deleteResume]", error);
    throw new Error("Failed to delete resume");
  }
}

export async function updateResumeText(resumeId: string, content: string) {
  const userId = await getAuthUserId();

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId, isDeleted: false },
  });
  if (!resume) throw new Error("Resume not found");

  const detectedSkills = extractSkillsFromContent(content);

  await prisma.resume.update({
    where: { id: resumeId },
    data: {
      content: content || null,
      detectedSkills,
      textQuality: content.split(/\s+/).filter((w) => w.length > 0).length >= 50 ? "good" : "poor",
    },
  });

  revalidatePath("/resumes");
  return { success: true, detectedSkills };
}

export async function updateResumeCategories(
  resumeId: string,
  targetCategories: string[]
) {
  const userId = await getAuthUserId();

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId, isDeleted: false },
  });
  if (!resume) throw new Error("Resume not found");

  await prisma.resume.update({
    where: { id: resumeId },
    data: { targetCategories },
  });

  revalidatePath("/resumes");
  return { success: true };
}

export async function setDefaultResume(resumeId: string) {
  const userId = await getAuthUserId();

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId, isDeleted: false },
  });
  if (!resume) throw new Error("Resume not found");

  await prisma.$transaction([
    prisma.resume.updateMany({
      where: { userId, isDeleted: false },
      data: { isDefault: false },
    }),
    prisma.resume.update({
      where: { id: resumeId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/resumes");
  return { success: true };
}
