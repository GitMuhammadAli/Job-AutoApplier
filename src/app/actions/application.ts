"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function prepareApplication(
  userJobId: string,
  data: { subject: string; emailBody: string; recipientEmail: string; resumeId?: string }
) {
  const userId = await getAuthUserId();

  const userJob = await prisma.userJob.findFirst({
    where: { id: userJobId, userId },
  });
  if (!userJob) throw new Error("Job not found");

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  const application = await prisma.jobApplication.upsert({
    where: { userJobId },
    update: {
      subject: data.subject,
      emailBody: data.emailBody,
      recipientEmail: data.recipientEmail,
      resumeId: data.resumeId || null,
      status: "DRAFT",
    },
    create: {
      userJobId,
      userId,
      senderEmail: settings?.applicationEmail || "",
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      emailBody: data.emailBody,
      resumeId: data.resumeId || null,
      coverLetter: userJob.coverLetter,
      status: "DRAFT",
    },
  });

  await prisma.activity.create({
    data: {
      userJobId,
      userId,
      type: "APPLICATION_PREPARED",
      description: `Application draft prepared for ${data.recipientEmail}`,
    },
  });

  revalidatePath(`/jobs/${userJobId}`);
  return application;
}

export async function markApplicationReady(applicationId: string) {
  const userId = await getAuthUserId();

  const app = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
  });
  if (!app) throw new Error("Application not found");

  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { status: "READY" },
  });

  revalidatePath(`/jobs/${app.userJobId}`);
}

export async function getApplicationForJob(userJobId: string) {
  const userId = await getAuthUserId();
  return prisma.jobApplication.findFirst({
    where: { userJobId, userId },
    include: { resume: { select: { name: true } } },
  });
}
