"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { decryptSettingsFields } from "@/lib/encryption";
import { z } from "zod";
import { LIMITS } from "@/lib/constants";

const emailSchema = z.string().email("Invalid email address");

export async function getApplications() {
  try {
    const userId = await getAuthUserId();

    const applications = await prisma.jobApplication.findMany({
      where: { userId },
      include: {
        userJob: {
          include: {
            globalJob: {
              select: {
                title: true,
                company: true,
                source: true,
                applyUrl: true,
                companyEmail: true,
                lastSeenAt: true,
                firstSeenAt: true,
              },
            },
          },
        },
        resume: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMITS.APPLICATIONS_PER_PAGE,
    });

    const seen = new Map<string, typeof applications[number]>();
    const deduped: typeof applications = [];

    for (const app of applications) {
      const job = app.userJob.globalJob;
      // Include source to distinguish the same role scraped from multiple platforms,
      // but collapse true duplicates (same source + same title + same company)
      const key = `${job.title.toLowerCase().trim()}::${job.company.toLowerCase().trim()}::${job.source}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, app);
        deduped.push(app);
      } else {
        const dominated =
          app.status === "DRAFT" && existing.status !== "DRAFT";
        if (dominated) continue;

        const better =
          app.status === "SENT" && existing.status !== "SENT";
        if (better) {
          const idx = deduped.indexOf(existing);
          if (idx !== -1) deduped[idx] = app;
          seen.set(key, app);
        }
      }
    }

    return deduped;
  } catch (error) {
    console.error("[getApplications]", error);
    throw new Error("Failed to load applications");
  }
}

export async function getApplicationCounts() {
  try {
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
  } catch (error) {
    console.error("[getApplicationCounts]", error);
    throw new Error("Failed to load application counts");
  }
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
  },
) {
  try {
    const userId = await getAuthUserId();

    emailSchema.parse(data.recipientEmail);
    if (!data.subject?.trim()) throw new Error("Subject is required");
    if (!data.emailBody?.trim()) throw new Error("Email body is required");
    if (data.subject.length > 500)
      throw new Error("Subject must be 500 characters or less");
    if (data.emailBody.length > 100_000)
      throw new Error("Email body must be 100,000 characters or less");
    if (data.coverLetter !== undefined && data.coverLetter.length > 100_000)
      throw new Error("Cover letter must be 100,000 characters or less");

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
    });
    if (!userJob) throw new Error("Job not found");

    const settings = decryptSettingsFields(
      await prisma.userSettings.findUnique({ where: { userId } }),
    );

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
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error(error.errors[0].message);
    if (
      error instanceof Error &&
      [
        "Job not found",
        "Subject is required",
        "Email body is required",
      ].includes(error.message)
    )
      throw error;
    console.error("[prepareApplication]", error);
    throw new Error("Failed to prepare application");
  }
}

export async function markApplicationReady(applicationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) return { success: false, error: "Application not found" };

    if (!app.recipientEmail?.trim()) {
      return { success: false, error: "Recipient email is required before marking ready" };
    }
    if (!app.subject?.trim()) {
      return { success: false, error: "Subject is required before marking ready" };
    }
    if (!app.emailBody?.trim()) {
      return { success: false, error: "Email body is required before marking ready" };
    }

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "READY", retryCount: 0 },
    });

    revalidatePath("/applications");
    revalidatePath(`/jobs/${app.userJobId}`);
    return { success: true };
  } catch (error) {
    console.error("[markApplicationReady] Error:", error);
    return { success: false, error: "Failed to mark application as ready" };
  }
}

export async function markApplicationManual(applicationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
      include: { userJob: { include: { globalJob: true } } },
    });
    if (!app) return { success: false, error: "Application not found" };

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
    return { success: true };
  } catch (error) {
    console.error("[markApplicationManual] Error:", error);
    return { success: false, error: "Failed to mark application as manually applied" };
  }
}

export async function bulkMarkReady(applicationIds: string[]) {
  try {
    const userId = await getAuthUserId();

    if (!applicationIds.length || applicationIds.length > 100) {
      throw new Error("Select 1-100 applications");
    }

    const count = await prisma.jobApplication.updateMany({
      where: {
        id: { in: applicationIds },
        userId,
        status: "DRAFT",
        recipientEmail: { not: "" },
        subject: { not: "" },
        emailBody: { not: "" },
      },
      data: { status: "READY" },
    });

    revalidatePath("/applications");
    return count.count;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Select")) throw error;
    console.error("[bulkMarkReady]", error);
    throw new Error("Failed to mark applications as ready");
  }
}

export async function cancelApplication(applicationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) return { success: false, error: "Application not found" };

    if (!["DRAFT", "READY"].includes(app.status)) {
      return { success: false, error: `Cannot cancel — application is already ${app.status.toLowerCase()}` };
    }

    await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: "CANCELLED", scheduledSendAt: null },
      }),
      prisma.activity.create({
        data: {
          userJobId: app.userJobId,
          userId,
          type: "APPLICATION_CANCELLED",
          description: "Application cancelled by user",
        },
      }),
    ]);

    revalidatePath("/applications");
    revalidatePath(`/jobs/${app.userJobId}`);
    return { success: true };
  } catch (error) {
    console.error("[cancelApplication] Error:", error);
    return { success: false, error: "Failed to cancel application" };
  }
}

export async function deleteApplication(applicationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) return { success: false, error: "Application not found" };

    await prisma.jobApplication.delete({
      where: { id: applicationId },
    });

    revalidatePath("/applications");
    revalidatePath(`/jobs/${app.userJobId}`);
    return { success: true };
  } catch (error) {
    console.error("[deleteApplication] Error:", error);
    return { success: false, error: "Failed to delete application" };
  }
}

export async function bulkDeleteByStatus(
  status: "FAILED" | "BOUNCED" | "CANCELLED",
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const result = await prisma.jobApplication.deleteMany({
      where: { userId, status },
    });
    revalidatePath("/applications");
    revalidatePath("/dashboard");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[bulkDeleteByStatus] Error:", error);
    return { success: false, count: 0, error: `Failed to delete ${status.toLowerCase()} applications` };
  }
}

export async function bulkCancelDrafts(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const result = await prisma.jobApplication.updateMany({
      where: { userId, status: "DRAFT" },
      data: { status: "CANCELLED" },
    });
    revalidatePath("/applications");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[bulkCancelDrafts] Error:", error);
    return { success: false, count: 0, error: "Failed to cancel drafts" };
  }
}

export async function startFresh(): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    await prisma.$transaction([
      prisma.activity.deleteMany({ where: { userId } }),
      prisma.jobApplication.deleteMany({ where: { userId } }),
      prisma.userJob.deleteMany({ where: { userId } }),
    ]);
    revalidatePath("/dashboard");
    revalidatePath("/applications");
    revalidatePath("/recommended");
    return { success: true };
  } catch (error) {
    console.error("[startFresh] Error:", error);
    return { success: false, error: "Failed to start fresh" };
  }
}

export async function getDraftableJobCount(): Promise<number> {
  try {
    const userId = await getAuthUserId();
    const count = await prisma.userJob.count({
      where: {
        userId,
        stage: "SAVED",
        application: null,
        globalJob: {
          companyEmail: { not: null },
          emailConfidence: { gte: 50 },
        },
      },
    });
    return count;
  } catch (error) {
    console.error("[getDraftableJobCount]", error);
    return 0;
  }
}

export async function getDraftableJobs(limit: number = 10): Promise<{ id: string; title: string; company: string }[]> {
  try {
    const userId = await getAuthUserId();
    const jobs = await prisma.userJob.findMany({
      where: {
        userId,
        stage: "SAVED",
        application: null,
        globalJob: {
          companyEmail: { not: null },
          emailConfidence: { gte: 50 },
        },
      },
      select: {
        id: true,
        matchScore: true,
        globalJob: { select: { title: true, company: true } },
      },
      orderBy: { matchScore: "desc" },
      take: limit,
    });
    return jobs.map((j) => ({
      id: j.id,
      title: j.globalJob.title,
      company: j.globalJob.company,
    }));
  } catch (error) {
    console.error("[getDraftableJobs]", error);
    return [];
  }
}

export async function getApplicationById(applicationId: string) {
  try {
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
  } catch (error) {
    if (error instanceof Error && error.message === "Application not found")
      throw error;
    console.error("[getApplicationById]", error);
    throw new Error("Failed to load application");
  }
}
