"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Stage } from "@/types";

const DEMO_USER_EMAIL = "ali@demo.com";

async function getDemoUserId(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) throw new Error("Demo user not found. Run prisma db seed.");
  return user.id;
}

export async function getJobs() {
  const userId = await getDemoUserId();

  const jobs = await prisma.job.findMany({
    where: { userId },
    include: {
      resumeUsed: true,
      activities: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((job) => ({
    ...job,
    appliedDate: job.appliedDate?.toISOString() ?? null,
    interviewDate: job.interviewDate?.toISOString() ?? null,
    followUpDate: job.followUpDate?.toISOString() ?? null,
    rejectedDate: job.rejectedDate?.toISOString() ?? null,
    offerDate: job.offerDate?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    activities: job.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    resumeUsed: job.resumeUsed
      ? { ...job.resumeUsed, createdAt: job.resumeUsed.createdAt.toISOString() }
      : null,
  }));
}

export async function updateStage(
  jobId: string,
  newStage: Stage,
  oldStage: Stage
) {
  const dateFields: Partial<Record<Stage, string>> = {
    APPLIED: "appliedDate",
    INTERVIEW: "interviewDate",
    OFFER: "offerDate",
    REJECTED: "rejectedDate",
  };

  const dateUpdate: Record<string, Date> = {};
  const dateField = dateFields[newStage];
  if (dateField) {
    dateUpdate[dateField] = new Date();
  }

  const isGhosted = newStage === "GHOSTED";

  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: {
        stage: newStage,
        isGhosted,
        ...dateUpdate,
      },
    }),
    prisma.activity.create({
      data: {
        jobId,
        type: "stage_change",
        fromStage: oldStage,
        toStage: newStage,
        note: `Moved from ${oldStage} to ${newStage}`,
      },
    }),
  ]);

  revalidatePath("/");
  return { success: true };
}
