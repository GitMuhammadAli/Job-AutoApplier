"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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

function serializeJob(job: any) {
  return {
    ...job,
    appliedDate: job.appliedDate?.toISOString() ?? null,
    interviewDate: job.interviewDate?.toISOString() ?? null,
    followUpDate: job.followUpDate?.toISOString() ?? null,
    rejectedDate: job.rejectedDate?.toISOString() ?? null,
    offerDate: job.offerDate?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    activities: (job.activities ?? []).map((a: any) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    resumeUsed: job.resumeUsed
      ? { ...job.resumeUsed, createdAt: job.resumeUsed.createdAt.toISOString() }
      : null,
  };
}

// ── Get all jobs ──
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
  return jobs.map(serializeJob);
}

// ── Get single job ──
export async function getJobById(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      resumeUsed: true,
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) return null;
  return serializeJob(job);
}

// ── Create job ──
const createJobSchema = z.object({
  company: z.string().min(1, "Company is required"),
  role: z.string().min(1, "Role is required"),
  url: z.string().url().optional().or(z.literal("")),
  platform: z.enum(["LINKEDIN", "INDEED", "GLASSDOOR", "ROZEE_PK", "BAYT", "COMPANY_SITE", "REFERRAL", "OTHER"]),
  stage: z.enum(["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"]),
  salary: z.string().optional(),
  location: z.string().optional(),
  workType: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
  resumeId: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  appliedDate: z.string().optional().or(z.literal("")),
});

export async function createJob(data: z.infer<typeof createJobSchema>) {
  const parsed = createJobSchema.parse(data);
  const userId = await getDemoUserId();

  const appliedDate =
    parsed.stage === "APPLIED" && !parsed.appliedDate
      ? new Date()
      : parsed.appliedDate
        ? new Date(parsed.appliedDate)
        : undefined;

  const job = await prisma.job.create({
    data: {
      company: parsed.company,
      role: parsed.role,
      url: parsed.url || null,
      platform: parsed.platform,
      stage: parsed.stage,
      salary: parsed.salary || null,
      location: parsed.location || null,
      workType: parsed.workType,
      resumeId: parsed.resumeId || null,
      notes: parsed.notes || null,
      contactName: parsed.contactName || null,
      contactEmail: parsed.contactEmail || null,
      appliedDate,
      userId,
    },
  });

  await prisma.activity.create({
    data: {
      jobId: job.id,
      type: "job_created",
      toStage: parsed.stage,
      note: `Job created with stage ${parsed.stage}`,
    },
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  return { success: true, id: job.id };
}

// ── Update job ──
export async function updateJob(
  id: string,
  data: Partial<z.infer<typeof createJobSchema>>
) {
  const existingJob = await prisma.job.findUnique({ where: { id } });
  if (!existingJob) throw new Error("Job not found");

  const stageChanged = data.stage && data.stage !== existingJob.stage;

  const dateUpdate: Record<string, Date> = {};
  if (stageChanged && data.stage) {
    const dateFields: Partial<Record<string, string>> = {
      APPLIED: "appliedDate",
      INTERVIEW: "interviewDate",
      OFFER: "offerDate",
      REJECTED: "rejectedDate",
    };
    const field = dateFields[data.stage];
    if (field) dateUpdate[field] = new Date();
  }

  const updated = await prisma.job.update({
    where: { id },
    data: {
      ...(data.company !== undefined && { company: data.company }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.url !== undefined && { url: data.url || null }),
      ...(data.platform !== undefined && { platform: data.platform }),
      ...(data.stage !== undefined && { stage: data.stage }),
      ...(data.salary !== undefined && { salary: data.salary || null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.workType !== undefined && { workType: data.workType }),
      ...(data.resumeId !== undefined && { resumeId: data.resumeId || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.contactName !== undefined && { contactName: data.contactName || null }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
      ...(data.appliedDate !== undefined && {
        appliedDate: data.appliedDate ? new Date(data.appliedDate) : null,
      }),
      isGhosted: data.stage === "GHOSTED",
      ...dateUpdate,
    },
  });

  if (stageChanged && data.stage) {
    await prisma.activity.create({
      data: {
        jobId: id,
        type: "stage_change",
        fromStage: existingJob.stage,
        toStage: data.stage,
        note: `Moved from ${existingJob.stage} to ${data.stage}`,
      },
    });
  }

  revalidatePath("/");
  revalidatePath(`/jobs/${id}`);
  return { success: true };
}

// ── Update stage (optimistic) ──
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
  if (dateField) dateUpdate[dateField] = new Date();

  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { stage: newStage, isGhosted: newStage === "GHOSTED", ...dateUpdate },
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

// ── Delete job ──
export async function deleteJob(id: string) {
  await prisma.job.delete({ where: { id } });
  revalidatePath("/");
  return { success: true };
}

// ── Add note ──
export async function addNote(jobId: string, note: string) {
  if (!note.trim()) throw new Error("Note cannot be empty");

  await prisma.activity.create({
    data: {
      jobId,
      type: "note_added",
      note: note.trim(),
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

// ── Get resumes for dropdown ──
export async function getResumes() {
  const userId = await getDemoUserId();
  const resumes = await prisma.resume.findMany({
    where: { userId },
    include: { _count: { select: { jobs: true } } },
    orderBy: { name: "asc" },
  });
  return resumes.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
