import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runApplicationPipeline } from "@/lib/agents/pipeline";
import { APPLICATIONS, GENERIC } from "@/lib/messages";
import { QuotaExceededError, formatRetryMessage } from "@/lib/quota/quota";
import { parseBody } from "@/lib/validation/parse-body";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

const PipelineBody = z.object({
  userJobId: z.string().trim().min(20).max(40),
});

export async function POST(req: NextRequest) {
  try {
    const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
    const parsed = await parseBody(req, PipelineBody);
    if (!parsed.ok) return parsed.response;
    const { userJobId } = parsed.data;

    // Load job details with ownership check
    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
      include: {
        globalJob: true,
      },
    });

    if (!userJob) {
      return NextResponse.json({ error: APPLICATIONS.JOB_NOT_FOUND }, { status: 404 });
    }

    // Load user profile (settings)
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({ error: APPLICATIONS.USER_PROFILE_NOT_FOUND }, { status: 400 });
    }

    const userName = settings.fullName ?? "Applicant";
    const userEmail = settings.applicationEmail ?? settings.notificationEmail ?? "";

    if (!userEmail) {
      return NextResponse.json(
        { error: APPLICATIONS.APPLICATION_EMAIL_NOT_CONFIGURED },
        { status: 400 }
      );
    }

    // Load default resume for skills
    const resume = await prisma.resume.findFirst({
      where: { userId, isDefault: true, isDeleted: false },
      select: { detectedSkills: true },
    });

    // Fall back to any resume if no default
    const anyResume = resume ?? await prisma.resume.findFirst({
      where: { userId, isDeleted: false },
      select: { detectedSkills: true },
    });

    const userSkills = [
      ...(anyResume?.detectedSkills ?? []),
      ...(settings.keywords ?? []),
    ];

    const job = userJob.globalJob;

    // Run the multi-agent pipeline
    const result = await runApplicationPipeline({
      companyName: job.company,
      jobDescription: job.description ?? "",
      jobTitle: job.title,
      userSkills,
      userName,
      userEmail,
      quota: { userId, route: "/api/applications/pipeline" },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "ai_quota_exceeded",
          reason: error.reason,
          message: formatRetryMessage(error.reason, error.retryAfterSeconds),
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
    const message = error instanceof Error ? error.message : APPLICATIONS.PIPELINE_FAILED;
    if (message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    await captureError(error, { route: "/api/applications/pipeline" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
