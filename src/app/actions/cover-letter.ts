"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { generateCoverLetter } from "@/lib/groq";

export async function generateCoverLetterAction(
  jobId: string
): Promise<{ coverLetter?: string; error?: string }> {
  try {
    if (!process.env.GROQ_API_KEY) {
      return { error: "GROQ_API_KEY is not configured. Add it in Settings." };
    }

    const userId = await getAuthUserId();

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      include: { resumeUsed: true },
    });

    if (!job) return { error: "Job not found" };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true, resumes: true },
    });

    const resume =
      job.resumeUsed || user?.resumes.find((r) => r.content) || null;
    if (!resume?.content) {
      return {
        error:
          "No resume content found. Paste your resume text in the Resumes page first.",
      };
    }

    const coverLetter = await generateCoverLetter({
      jobTitle: job.role,
      company: job.company,
      jobDescription: job.description || `${job.role} at ${job.company}`,
      location: job.location,
      resumeContent: resume.content,
      userName: user?.name,
      skills: user?.settings?.skills,
      experienceLevel: user?.settings?.experienceLevel,
    });

    return { coverLetter };
  } catch (err) {
    console.error("Cover letter generation error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to generate cover letter",
    };
  }
}
