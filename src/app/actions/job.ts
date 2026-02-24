"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobStage } from "@prisma/client";
import { LIMITS } from "@/lib/constants";
import { getSettings } from "@/app/actions/settings";
import {
  jobMatchesPlatformPreferences,
  deduplicateUserJobsByLogicalJob,
} from "@/lib/matching/location-filter";

// ── Get all user jobs (for Kanban board) — only jobs matching user's city/country from settings ──

export async function getJobs(preloadedSettings?: Awaited<ReturnType<typeof getSettings>> | null) {
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
      preloadedSettings !== undefined ? Promise.resolve(preloadedSettings) : getSettings(),
    ]);

    const preferredPlatforms = settings?.preferredPlatforms ?? [];
    const blacklist = (settings?.blacklistedCompanies ?? []).map((c: string) => c.toLowerCase().trim()).filter(Boolean);
    const userCity = (settings?.city ?? "").toLowerCase().split(",")[0]?.trim();
    const userCountry = (settings?.country ?? "").toLowerCase().trim();
    const remoteWords = ["remote", "worldwide", "anywhere", "global", "work from home", "distributed", "wfh", "telecommute"];

    const filtered = userJobs.filter((j) => {
      if (!jobMatchesPlatformPreferences(j.globalJob.source, preferredPlatforms)) return false;
      if (blacklist.length > 0) {
        const co = j.globalJob.company.toLowerCase().trim();
        if (blacklist.some((bl: string) => co.includes(bl) || bl.includes(co))) return false;
      }
      if (userCity) {
        const loc = (j.globalJob.location ?? "").toLowerCase();
        if (loc && loc !== "n/a" && loc !== "not specified") {
          const inCity = loc.includes(userCity);
          const isRemote = remoteWords.some((r) => loc.includes(r));
          const countryOnly = userCountry &&
            loc.replace(new RegExp(userCountry, "g"), "").replace(/[\s,.\-]+/g, "").length === 0;
          if (!inCity && !isRemote && !countryOnly) return false;
        }
      }
      return true;
    });
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

// ── Save/Dismiss from recommended page (by GlobalJob ID) ──

export async function saveGlobalJob(globalJobId: string): Promise<{ success: boolean; userJobId?: string; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const userJob = await prisma.userJob.upsert({
      where: { userId_globalJobId: { userId, globalJobId } },
      create: { userId, globalJobId, stage: "SAVED" },
      update: { isDismissed: false, stage: "SAVED" },
    });
    revalidatePath("/recommended");
    return { success: true, userJobId: userJob.id };
  } catch (error) {
    console.error("[saveGlobalJob] Error:", error);
    return { success: false, error: "Failed to save job" };
  }
}

export async function dismissGlobalJob(globalJobId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    await prisma.userJob.upsert({
      where: { userId_globalJobId: { userId, globalJobId } },
      create: { userId, globalJobId, isDismissed: true, dismissReason: reason },
      update: { isDismissed: true, dismissReason: reason },
    });
    revalidatePath("/recommended");
    return { success: true };
  } catch (error) {
    console.error("[dismissGlobalJob] Error:", error);
    return { success: false, error: "Failed to dismiss job" };
  }
}

// ── Bulk actions ──

export async function bulkDismissJobs(userJobIds: string[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (userJobIds.length === 0) return { success: true, count: 0 };
    if (userJobIds.length > 500) return { success: false, count: 0, error: "Too many jobs selected (max 500)" };

    const result = await prisma.userJob.updateMany({
      where: { id: { in: userJobIds }, userId },
      data: { isDismissed: true, dismissReason: "Bulk dismissed" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[bulkDismissJobs] Error:", error);
    return { success: false, count: 0, error: "Failed to bulk dismiss" };
  }
}

export async function bulkDeleteOldJobs(olderThanDays: number): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.userJob.updateMany({
      where: {
        userId,
        isDismissed: false,
        stage: "SAVED",
        createdAt: { lt: cutoff },
        application: null,
      },
      data: { isDismissed: true, dismissReason: `Auto-cleared: older than ${olderThanDays} days` },
    });

    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[bulkDeleteOldJobs] Error:", error);
    return { success: false, count: 0, error: "Failed to clear old jobs" };
  }
}

export async function bulkDismissByStage(stage: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const result = await prisma.userJob.updateMany({
      where: { userId, stage: stage as JobStage, isDismissed: false },
      data: { isDismissed: true, dismissReason: `Bulk cleared stage: ${stage}` },
    });

    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[bulkDismissByStage] Error:", error);
    return { success: false, count: 0, error: "Failed to clear stage" };
  }
}

// ── Bulk dismiss from recommended page (by GlobalJob IDs) ──

export async function bulkDismissGlobalJobs(
  globalJobIds: string[],
): Promise<{ success: boolean; count: number; error?: string }> {
  if (globalJobIds.length > 500) return { success: false, count: 0, error: "Max 500 at once" };
  try {
    const userId = await getAuthUserId();
    let count = 0;

    for (const globalJobId of globalJobIds) {
      await prisma.userJob.upsert({
        where: { userId_globalJobId: { userId, globalJobId } },
        create: { userId, globalJobId, isDismissed: true, dismissReason: "Bulk dismissed" },
        update: { isDismissed: true, dismissReason: "Bulk dismissed" },
      });
      count++;
    }

    revalidatePath("/recommended");
    revalidatePath("/dashboard");
    return { success: true, count };
  } catch (error) {
    console.error("[bulkDismissGlobalJobs] Error:", error);
    return { success: false, count: 0, error: "Failed to bulk dismiss" };
  }
}

// ── Bulk dismiss low-score jobs from recommended ──

export async function bulkDismissBelowScore(
  maxScore: number,
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const result = await prisma.userJob.updateMany({
      where: {
        userId,
        isDismissed: false,
        matchScore: { lt: maxScore },
        application: null,
      },
      data: { isDismissed: true, dismissReason: `Score below ${maxScore}` },
    });

    revalidatePath("/recommended");
    revalidatePath("/dashboard");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[bulkDismissBelowScore] Error:", error);
    return { success: false, count: 0, error: "Failed to dismiss" };
  }
}

// ── Start Fresh (nuclear option) ──

export async function startFresh(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const [appResult, jobResult] = await prisma.$transaction([
      prisma.jobApplication.deleteMany({ where: { userId } }),
      prisma.userJob.deleteMany({ where: { userId } }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/recommended");
    revalidatePath("/applications");
    return { success: true, count: jobResult.count };
  } catch (error) {
    console.error("[startFresh] Error:", error);
    return { success: false, count: 0, error: "Failed to start fresh" };
  }
}

// ── Today's Queue (top 10 new jobs for quick daily application) ──

export async function getTodaysQueue() {
  try {
    const userId = await getAuthUserId();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const jobs = await prisma.userJob.findMany({
      where: {
        userId,
        isDismissed: false,
        stage: "SAVED",
        application: null,
        createdAt: { gte: since },
        matchScore: { gte: 40 },
      },
      select: {
        id: true,
        matchScore: true,
        matchReasons: true,
        createdAt: true,
        globalJob: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            source: true,
            sourceUrl: true,
            applyUrl: true,
            companyEmail: true,
            emailConfidence: true,
            postedDate: true,
            jobType: true,
          },
        },
      },
      orderBy: { matchScore: "desc" },
      take: 15,
    });

    const autoApply = jobs
      .filter((j) => j.globalJob.companyEmail && (j.globalJob.emailConfidence ?? 0) >= 70)
      .slice(0, 5);
    const quickApply = jobs
      .filter((j) => !autoApply.some((a) => a.id === j.id))
      .slice(0, 10 - autoApply.length);

    return { autoApply, quickApply, total: autoApply.length + quickApply.length };
  } catch (error) {
    console.error("[getTodaysQueue] Error:", error);
    return { autoApply: [], quickApply: [], total: 0 };
  }
}

// ── Mark as applied from site (quick track without email) ──

export async function markAppliedFromSite(
  userJobId: string,
  platform?: string,
) {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
      include: { globalJob: { select: { title: true, company: true } } },
    });
    if (!userJob) return { success: false, error: "Job not found" };

    await prisma.userJob.update({
      where: { id: userJobId },
      data: { stage: "APPLIED" },
    });

    const existing = await prisma.jobApplication.findUnique({
      where: { userJobId },
    });

    if (!existing) {
      await prisma.jobApplication.create({
        data: {
          userJobId,
          userId,
          senderEmail: "",
          recipientEmail: "",
          subject: `Applied to ${userJob.globalJob.title} at ${userJob.globalJob.company}`,
          emailBody: `Applied via ${platform || "job site"}`,
          status: "SENT",
          appliedVia: "PLATFORM",
          sentAt: new Date(),
        },
      });
    }

    await prisma.activity.create({
      data: {
        userId,
        userJobId,
        type: "APPLICATION_SENT",
        description: `Applied via ${platform || "job site"}`,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/applications");
    return { success: true };
  } catch (error) {
    console.error("[markAppliedFromSite] Error:", error);
    return { success: false, error: "Failed to mark as applied" };
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
