"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobStage } from "@prisma/client";
import { LIMITS } from "@/lib/constants";
import { getSettings } from "@/app/actions/settings";
import { jobMatchesLocationPreferences, deduplicateUserJobsByLogicalJob } from "@/lib/matching/location-filter";

// ── Get all user jobs (for Kanban board) — only jobs matching user's city/country from settings ──

export async function getJobs() {
  try {
    const userId = await getAuthUserId();

    const [userJobs, settings] = await Promise.all([
      prisma.userJob.findMany({
        where: {
          userId,
          isDismissed: false,
          matchScore: { gte: 40 },
        },
        include: {
          globalJob: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true,
              salary: true,
              jobType: true,
              experienceLevel: true,
              category: true,
              skills: true,
              source: true,
              applyUrl: true,
              sourceUrl: true,
              companyUrl: true,
              companyEmail: true,
              isFresh: true,
              isActive: true,
              postedDate: true,
              createdAt: true,
              lastSeenAt: true,
              firstSeenAt: true,
            },
          },
          application: {
            select: { id: true, status: true, sentAt: true },
          },
        },
        orderBy: { matchScore: "desc" },
        take: LIMITS.JOBS_PER_PAGE,
      }),
      getSettings(),
    ]);

    const city = settings?.city ?? null;
    const country = settings?.country ?? null;
    const filtered = userJobs.filter((j) =>
      jobMatchesLocationPreferences(j.globalJob.location, city, country)
    );
    const deduped = deduplicateUserJobsByLogicalJob(filtered);

    return deduped;
  } catch (error) {
    console.error("[getJobs]", error);
    throw new Error("Failed to load jobs");
  }
}

// ── Get single job by ID (for detail page) ──

export async function getJobById(id: string) {
  try {
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
  } catch (error) {
    if (error instanceof Error && error.message === "Job not found")
      throw error;
    console.error("[getJobById]", error);
    throw new Error("Failed to load job details");
  }
}

// ── Update stage (drag-drop or manual) ──

export async function updateStage(
  userJobId: string,
  newStage: JobStage,
  oldStage: JobStage,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
    });
    if (!userJob) return { success: false, error: "Job not found" };

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
    return { success: true };
  } catch (error) {
    console.error("[updateStage] Error:", error);
    return { success: false, error: "Failed to update job stage" };
  }
}

// ── Dismiss job ──

export async function dismissJob(userJobId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
    });
    if (!userJob) return { success: false, error: "Job not found" };

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
    return { success: true };
  } catch (error) {
    console.error("[dismissJob] Error:", error);
    return { success: false, error: "Failed to dismiss job" };
  }
}

// ── Add note ──

export async function addNote(userJobId: string, note: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    if (!note || note.length > 10000)
      return { success: false, error: "Note must be 1-10,000 characters" };

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
    });
    if (!userJob) return { success: false, error: "Job not found" };

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
    return { success: true };
  } catch (error) {
    console.error("[addNote] Error:", error);
    return { success: false, error: "Failed to save note" };
  }
}

// ── Toggle bookmark ──

export async function toggleBookmark(userJobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
    });
    if (!userJob) return { success: false, error: "Job not found" };

    await prisma.userJob.update({
      where: { id: userJobId },
      data: { isBookmarked: !userJob.isBookmarked },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("[toggleBookmark] Error:", error);
    return { success: false, error: "Failed to toggle bookmark" };
  }
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

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export async function createManualJob(rawData: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const data = createJobSchema.parse(rawData);

    const normTitle = normalizeForMatch(data.title);
    const normCompany = normalizeForMatch(data.company);

    const candidates = await prisma.globalJob.findMany({
      where: {
        company: { contains: data.company.split(" ")[0], mode: "insensitive" },
      },
      select: { id: true, title: true, company: true },
      take: 100,
    });

    const existingMatch = candidates.find((c) => {
      const ct = normalizeForMatch(c.title);
      const cc = normalizeForMatch(c.company);
      return ct === normTitle && cc === normCompany;
    });

    await prisma.$transaction(async (tx) => {
      let globalJobId: string;

      if (existingMatch) {
        globalJobId = existingMatch.id;

        const existingLink = await tx.userJob.findFirst({
          where: { userId, globalJobId },
        });
        if (existingLink) {
          throw new Error("You already have this job in your board.");
        }
      } else {
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
        globalJobId = globalJob.id;
      }

      const userJob = await tx.userJob.create({
        data: {
          userId,
          globalJobId,
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
          description: existingMatch
            ? "Job manually added (linked to existing listing)"
            : "Job manually added",
        },
      });
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "You already have this job in your board.")
      return { success: false, error: error.message };
    if (error instanceof z.ZodError) return { success: false, error: error.errors[0].message };
    console.error("[createManualJob] Error:", error);
    return { success: false, error: "Failed to add job. Please try again." };
  }
}

// ── Get resumes (for dropdowns) ──

export async function getResumes() {
  try {
    const userId = await getAuthUserId();
    return prisma.resume.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: LIMITS.RESUMES_PER_PAGE,
    });
  } catch (error) {
    console.error("[getResumes] Error:", error);
    throw new Error("Failed to load resumes");
  }
}
