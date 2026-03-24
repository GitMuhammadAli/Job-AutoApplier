import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runApplicationPipeline } from "@/lib/agents/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const { userJobId } = await req.json();

    if (!userJobId) {
      return NextResponse.json({ error: "userJobId required" }, { status: 400 });
    }

    // Load job details with ownership check
    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
      include: {
        globalJob: true,
      },
    });

    if (!userJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Load user profile (settings)
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({ error: "User profile not found. Please complete your profile first." }, { status: 400 });
    }

    const userName = settings.fullName ?? "Applicant";
    const userEmail = settings.applicationEmail ?? settings.notificationEmail ?? "";

    if (!userEmail) {
      return NextResponse.json(
        { error: "Application email not configured. Please set it in Settings." },
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
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[PipelineRoute] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
