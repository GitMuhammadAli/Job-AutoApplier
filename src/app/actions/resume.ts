"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { extractSkillsFromContent } from "@/lib/skill-extractor";

export async function getResumesWithStats() {
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
}

export async function createResume(name: string, fileUrl?: string, content?: string) {
  const userId = await getAuthUserId();

  if (!name.trim()) throw new Error("Name is required");

  await prisma.resume.create({
    data: {
      name: name.trim(),
      fileUrl: fileUrl || null,
      content: content || null,
      userId,
    },
  });

  revalidatePath("/resumes");
  return { success: true };
}

export async function updateResume(
  id: string,
  data: { name?: string; fileUrl?: string; content?: string; isDefault?: boolean },
) {
  const userId = await getAuthUserId();

  // Verify ownership
  const resume = await prisma.resume.findFirst({ where: { id, userId } });
  if (!resume) throw new Error("Resume not found");

  if (data.isDefault) {
    // Unset other defaults first
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
}

export async function deleteResume(id: string) {
  const userId = await getAuthUserId();

  const resume = await prisma.resume.findFirst({ where: { id, userId } });
  if (!resume) throw new Error("Resume not found");

  await prisma.resume.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  revalidatePath("/resumes");
  return { success: true };
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
