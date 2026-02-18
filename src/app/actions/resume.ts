"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getResumesWithStats() {
  const userId = await getAuthUserId();

  const resumes = await prisma.resume.findMany({
    where: { userId },
    include: {
      _count: { select: { jobs: true } },
      jobs: {
        select: { stage: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return resumes.map((r) => {
    const applied = r.jobs.filter((j) => j.stage !== "SAVED").length;
    const responded = r.jobs.filter((j) =>
      ["INTERVIEW", "OFFER"].includes(j.stage),
    ).length;
    const responseRate =
      applied > 0 ? Math.round((responded / applied) * 100) : 0;

    return {
      id: r.id,
      name: r.name,
      fileUrl: r.fileUrl,
      content: r.content,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      jobCount: r._count.jobs,
      responseRate,
    };
  });
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
  data: { name?: string; fileUrl?: string; content?: string },
) {
  await prisma.resume.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl || null }),
      ...(data.content !== undefined && { content: data.content || null }),
    },
  });

  revalidatePath("/resumes");
  return { success: true };
}

export async function deleteResume(id: string) {
  await prisma.resume.delete({ where: { id } });
  revalidatePath("/resumes");
  return { success: true };
}
