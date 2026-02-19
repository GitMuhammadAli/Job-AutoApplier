"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getApplications() {
  const userId = await getAuthUserId();

  const applications = await prisma.jobApplication.findMany({
    where: { userId },
    include: {
      userJob: {
        include: {
          globalJob: {
            select: { title: true, company: true, source: true, applyUrl: true },
          },
        },
      },
      resume: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications;
}

export async function getApplicationCounts() {
  const userId = await getAuthUserId();

  const [draft, ready, sent, failed, bounced, total] = await Promise.all([
    prisma.jobApplication.count({ where: { userId, status: "DRAFT" } }),
    prisma.jobApplication.count({ where: { userId, status: "READY" } }),
    prisma.jobApplication.count({ where: { userId, status: "SENT" } }),
    prisma.jobApplication.count({ where: { userId, status: "FAILED" } }),
    prisma.jobApplication.count({ where: { userId, status: "BOUNCED" } }),
    prisma.jobApplication.count({ where: { userId } }),
  ]);

  return { draft, ready, sent, failed, bounced, total };
}

export async function prepareApplication(
  userJobId: string,
  data: {
    recipientEmail: string;
    subject: string;
    emailBody: string;
    coverLetter?: string;
    resumeId?: string;
    templateId?: string;
  }
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
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      emailBody: data.emailBody,
      coverLetter: data.coverLetter ?? undefined,
      resumeId: data.resumeId ?? null,
      templateId: data.templateId ?? null,
      status: "DRAFT",
    },
    create: {
      userJobId,
      userId,
      senderEmail: settings?.applicationEmail ?? "",
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      emailBody: data.emailBody,
      coverLetter: data.coverLetter ?? userJob.coverLetter ?? undefined,
      resumeId: data.resumeId ?? null,
      templateId: data.templateId ?? null,
      status: "DRAFT",
    },
  });

  revalidatePath("/applications");
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
    data: { status: "READY", retryCount: 0 },
  });

  revalidatePath("/applications");
  revalidatePath(`/jobs/${app.userJobId}`);
}

export async function markApplicationManual(applicationId: string) {
  const userId = await getAuthUserId();

  const app = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    include: { userJob: { include: { globalJob: true } } },
  });
  if (!app) throw new Error("Application not found");

  await prisma.$transaction([
    prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: "SENT",
        appliedVia: "MANUAL",
        sentAt: new Date(),
      },
    }),
    prisma.userJob.update({
      where: { id: app.userJobId },
      data: { stage: "APPLIED" },
    }),
    prisma.activity.create({
      data: {
        userJobId: app.userJobId,
        userId,
        type: "APPLICATION_SENT",
        description: `Manually marked as applied for ${app.userJob.globalJob.title} at ${app.userJob.globalJob.company}`,
      },
    }),
  ]);

  revalidatePath("/applications");
  revalidatePath("/");
  revalidatePath(`/jobs/${app.userJobId}`);
}

export async function bulkMarkReady(applicationIds: string[]) {
  const userId = await getAuthUserId();

  const count = await prisma.jobApplication.updateMany({
    where: { id: { in: applicationIds }, userId, status: "DRAFT" },
    data: { status: "READY" },
  });

  revalidatePath("/applications");
  return count.count;
}

export async function deleteApplication(applicationId: string) {
  const userId = await getAuthUserId();

  const app = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
  });
  if (!app) throw new Error("Application not found");

  await prisma.jobApplication.delete({
    where: { id: applicationId },
  });

  revalidatePath("/applications");
  revalidatePath(`/jobs/${app.userJobId}`);
}

export async function getApplicationById(applicationId: string) {
  const userId = await getAuthUserId();

  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    include: {
      userJob: {
        include: {
          globalJob: true,
        },
      },
      resume: true,
    },
  });

  if (!application) throw new Error("Application not found");
  return application;
}
