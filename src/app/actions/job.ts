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
              emailConfidence: true,
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
            loc.split(userCountry).join("").replace(/[\s,.\-]+/g, "").length === 0;
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
  companyEmail: z.string().email().optional().or(z.literal("")),
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
            companyEmail: data.companyEmail || null,
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

export async function undismissGlobalJob(globalJobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    await prisma.userJob.updateMany({
      where: { userId, globalJobId },
      data: { isDismissed: false, dismissReason: null },
    });
    revalidatePath("/recommended");
    return { success: true };
  } catch (error) {
    console.error("[undismissGlobalJob] Error:", error);
    return { success: false, error: "Failed to restore job" };
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

    // updateMany doesn't support relation filters, so find IDs first
    const candidates = await prisma.userJob.findMany({
      where: {
        userId,
        isDismissed: false,
        stage: "SAVED",
        createdAt: { lt: cutoff },
        application: null,
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { success: true, count: 0 };
    }

    const result = await prisma.userJob.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
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

    // Update existing userJob rows in one query
    const updated = await prisma.userJob.updateMany({
      where: { userId, globalJobId: { in: globalJobIds } },
      data: { isDismissed: true, dismissReason: "Bulk dismissed" },
    });

    // Find which globalJobIds don't have a userJob yet
    const existing = await prisma.userJob.findMany({
      where: { userId, globalJobId: { in: globalJobIds } },
      select: { globalJobId: true },
    });
    const existingSet = new Set(existing.map((e) => e.globalJobId));
    const missing = globalJobIds.filter((id) => !existingSet.has(id));

    // Batch-create missing ones
    let created = 0;
    if (missing.length > 0) {
      const result = await prisma.userJob.createMany({
        data: missing.map((globalJobId) => ({
          userId,
          globalJobId,
          isDismissed: true,
          dismissReason: "Bulk dismissed",
        })),
        skipDuplicates: true,
      });
      created = result.count;
    }

    revalidatePath("/recommended");
    revalidatePath("/dashboard");
    return { success: true, count: updated.count + created };
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

    // updateMany doesn't support relation filters, so find IDs first
    const candidates = await prisma.userJob.findMany({
      where: {
        userId,
        isDismissed: false,
        matchScore: { lt: maxScore },
        application: null,
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { success: true, count: 0 };
    }

    const result = await prisma.userJob.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
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
    throw new Error("Failed to load today's queue");
  }
}

// ── Bulk mark as applied — pairs with the "Open top N in tabs" feature so
// the user can blast through 10 ATS forms and update tracking once instead
// of clicking "I Applied" 10 times.
//
// Accepts a mix of globalJobIds (job not yet saved) and userJobIds. For
// global IDs that don't have a UserJob row yet, creates one. For each
// resulting userJob, sets stage = APPLIED and creates a placeholder
// JobApplication marked SENT via PLATFORM.

export async function bulkMarkAppliedFromSite(input: {
  globalJobIds?: string[];
  userJobIds?: string[];
  platform?: string;
}): Promise<{ success: boolean; markedCount: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const totalIds =
      (input.globalJobIds?.length || 0) + (input.userJobIds?.length || 0);
    if (totalIds === 0) {
      return { success: false, markedCount: 0, error: "No jobs provided" };
    }
    if (totalIds > 50) {
      return { success: false, markedCount: 0, error: "Limit 50 per batch" };
    }

    let markedCount = 0;

    // 1. Promote any globalJobIds → userJobs (create if missing) so we
    //    have a single shape to mark applied.
    const userJobIds = new Set<string>(input.userJobIds || []);
    if (input.globalJobIds?.length) {
      for (const globalJobId of input.globalJobIds) {
        const existing = await prisma.userJob.findFirst({
          where: { userId, globalJobId },
          select: { id: true },
        });
        if (existing) {
          userJobIds.add(existing.id);
        } else {
          const created = await prisma.userJob.create({
            data: {
              userId,
              globalJobId,
              stage: "APPLIED",
              isBookmarked: true,
            },
            select: { id: true },
          });
          userJobIds.add(created.id);
        }
      }
    }

    // 2. For every userJob in scope, set stage + ensure a placeholder
    //    application row exists.
    const targets = await prisma.userJob.findMany({
      where: { userId, id: { in: Array.from(userJobIds) } },
      include: { globalJob: { select: { title: true, company: true } } },
    });

    for (const userJob of targets) {
      await prisma.userJob.update({
        where: { id: userJob.id },
        data: { stage: "APPLIED" },
      });

      const existingApp = await prisma.jobApplication.findUnique({
        where: { userJobId: userJob.id },
      });

      if (!existingApp) {
        await prisma.jobApplication.create({
          data: {
            userJobId: userJob.id,
            userId,
            senderEmail: "",
            recipientEmail: "",
            subject: `Applied to ${userJob.globalJob.title} at ${userJob.globalJob.company}`,
            emailBody: `Applied via ${input.platform || "job site"} (bulk)`,
            status: "SENT",
            appliedVia: "PLATFORM",
            sentAt: new Date(),
          },
        });
      } else if (existingApp.status !== "SENT") {
        // Bump existing draft/ready entries to SENT so the queue is clean.
        await prisma.jobApplication.update({
          where: { id: existingApp.id },
          data: {
            status: "SENT",
            appliedVia: "PLATFORM",
            sentAt: new Date(),
          },
        });
      }

      await prisma.activity.create({
        data: {
          userId,
          userJobId: userJob.id,
          type: "APPLICATION_SENT",
          description: `Applied via ${input.platform || "job site"} (bulk)`,
        },
      });

      markedCount++;
    }

    revalidatePath("/dashboard");
    revalidatePath("/recommended");
    revalidatePath("/applications");
    return { success: true, markedCount };
  } catch (error) {
    console.error("[bulkMarkAppliedFromSite] Error:", error);
    return { success: false, markedCount: 0, error: "Failed to mark batch applied" };
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
