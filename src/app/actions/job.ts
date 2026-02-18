"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobStage } from "@prisma/client";

// ── Get all user jobs (for Kanban board) ──

export async function getJobs() {
  const userId = await getAuthUserId();

  const userJobs = await prisma.userJob.findMany({
    where: { userId, isDismissed: false },
    include: {
      globalJob: true,
      application: {
        select: { id: true, status: true, sentAt: true },
      },
    },
    orderBy: { matchScore: "desc" },
  });

  return userJobs;
}

// ── Get single job by ID (for detail page) ──

export async function getJobById(id: string) {
  const userId = await getAuthUserId();

  const userJob = await prisma.userJob.findFirst({
    where: { id, userId },
    include: {
      globalJob: true,
      application: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!userJob) throw new Error("Job not found");
  return userJob;
}

// ── Update stage (drag-drop or manual) ──

export async function updateStage(
  userJobId: string,
  newStage: JobStage,
  oldStage: JobStage
) {
  const userId = await getAuthUserId();

  const userJob = await prisma.userJob.findFirst({
    where: { id: userJobId, userId },
  });
  if (!userJob) throw new Error("Job not found");

  await prisma.$transaction([
    prisma.userJob.update({
      where: { id: userJobId },
      data: { stage: newStage },
    }),
    prisma.activity.create({
      data: {
        userJobId,
        userId,
        type: "STAGE_CHANGE",
        description: `Moved from ${oldStage} to ${newStage}`,
      },
    }),
  ]);

  revalidatePath("/");
}

// ── Dismiss job ──

export async function dismissJob(userJobId: string, reason?: string) {
  const userId = await getAuthUserId();

  await prisma.$transaction([
    prisma.userJob.update({
      where: { id: userJobId },
      data: { isDismissed: true, dismissReason: reason || null },
    }),
    prisma.activity.create({
      data: {
        userJobId,
        userId,
        type: "DISMISSED",
        description: reason ? `Dismissed: ${reason}` : "Dismissed",
      },
    }),
  ]);

  revalidatePath("/");
}

// ── Add note ──

export async function addNote(userJobId: string, note: string) {
  const userId = await getAuthUserId();

  await prisma.$transaction([
    prisma.userJob.update({
      where: { id: userJobId },
      data: { notes: note },
    }),
    prisma.activity.create({
      data: {
        userJobId,
        userId,
        type: "NOTE_ADDED",
        description: "Note updated",
      },
    }),
  ]);

  revalidatePath(`/jobs/${userJobId}`);
}

// ── Toggle bookmark ──

export async function toggleBookmark(userJobId: string) {
  const userId = await getAuthUserId();

  const userJob = await prisma.userJob.findFirst({
    where: { id: userJobId, userId },
  });
  if (!userJob) throw new Error("Job not found");

  await prisma.userJob.update({
    where: { id: userJobId },
    data: { isBookmarked: !userJob.isBookmarked },
  });

  revalidatePath("/");
}

// ── Create manual job ──

const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  location: z.string().optional(),
  description: z.string().optional(),
  salary: z.string().optional(),
  applyUrl: z.string().url().optional().or(z.literal("")),
  jobType: z.string().optional(),
  notes: z.string().optional(),
});

export async function createManualJob(rawData: unknown) {
  const userId = await getAuthUserId();
  const data = createJobSchema.parse(rawData);

  const result = await prisma.$transaction(async (tx) => {
    const globalJob = await tx.globalJob.create({
      data: {
        title: data.title,
        company: data.company,
        location: data.location || null,
        description: data.description || null,
        salary: data.salary || null,
        applyUrl: data.applyUrl || null,
        jobType: data.jobType || null,
        source: "manual",
        sourceId: `manual-${userId}-${Date.now()}`,
        isActive: true,
        lastSeenAt: new Date(),
        skills: [],
      },
    });

    const userJob = await tx.userJob.create({
      data: {
        userId,
        globalJobId: globalJob.id,
        stage: "SAVED",
        matchScore: 100,
        matchReasons: ["Manually added"],
        notes: data.notes || null,
      },
    });

    await tx.activity.create({
      data: {
        userJobId: userJob.id,
        userId,
        type: "MANUAL_UPDATE",
        description: "Job manually added",
      },
    });

    return userJob;
  });

  revalidatePath("/");
  return result;
}

// ── Get resumes (for dropdowns) ──

export async function getResumes() {
  const userId = await getAuthUserId();
  return prisma.resume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
