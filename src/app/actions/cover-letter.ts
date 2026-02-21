"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { decryptSettingsFields } from "@/lib/encryption";
import { TIMEOUTS } from "@/lib/constants";

export async function generateCoverLetter(userJobId: string) {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
      include: { globalJob: true },
    });
    if (!userJob) throw new Error("Job not found");

    const settings = decryptSettingsFields(
      await prisma.userSettings.findUnique({ where: { userId } }),
    );

    const resumes = await prisma.resume.findMany({
      where: { userId },
      select: { name: true, content: true },
    });

    const bestResume = resumes.find((r) => r.content) || resumes[0];

    const job = userJob.globalJob;
    const tone = settings?.preferredTone || "professional";
    const lang = settings?.emailLanguage || "English";
    const customPrompt = settings?.customSystemPrompt || "";
    const name = settings?.fullName || "the applicant";
    const closing =
      settings?.customClosing || "Looking forward to hearing from you";

    const links: string[] = [];
    if (settings?.includeLinkedin && settings.linkedinUrl)
      links.push(`LinkedIn: ${settings.linkedinUrl}`);
    if (settings?.includeGithub && settings.githubUrl)
      links.push(`GitHub: ${settings.githubUrl}`);
    if (settings?.includePortfolio && settings.portfolioUrl)
      links.push(`Portfolio: ${settings.portfolioUrl}`);

    const systemPrompt = `You are an expert job application cover letter writer. Write in ${lang} with a ${tone} tone.
${customPrompt ? `Additional instructions: ${customPrompt}` : ""}
Write a concise cover letter (150-250 words) that:
- Opens with genuine interest in the specific role and company
- Highlights 2-3 relevant skills/experiences that match the job
- Shows knowledge of what the company does if possible
- Ends with a clear call to action
- Sounds human, not generic or AI-generated
Do NOT use placeholder brackets like [Your Name]. Use the actual name provided.`;

    const sanitize = (t: string) =>
      t.replace(/```[\s\S]*?```/g, "")
        .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/gi, "[filtered]")
        .replace(/\b(system|assistant|user)\s*:/gi, "[filtered]:")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 3000);

    const userPrompt = `Write a cover letter for:

Position: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
${job.description ? `Job Description (first 1500 chars): ${sanitize(job.description)}` : ""}
${(job.skills ?? []).length > 0 ? `Required Skills: ${(job.skills ?? []).join(", ")}` : ""}

Applicant: ${name}
${bestResume?.content ? `Resume Summary: ${bestResume.content.slice(0, 1000)}` : ""}
${links.length > 0 ? `Links: ${links.join(" | ")}` : ""}

Sign off with: ${closing}
Applicant name: ${name}`;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY not configured. Add it in Vercel env vars.",
      );
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(TIMEOUTS.AI_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI generation failed: ${err}`);
    }

    const data = await response.json();
    const coverLetter = data.choices?.[0]?.message?.content?.trim();

    if (!coverLetter) throw new Error("Empty response from AI");

    await prisma.$transaction([
      prisma.userJob.update({
        where: { id: userJobId },
        data: { coverLetter },
      }),
      prisma.activity.create({
        data: {
          userJobId,
          userId,
          type: "COVER_LETTER_GENERATED",
          description: `Cover letter generated (${tone} tone, ${lang})`,
        },
      }),
    ]);

    revalidatePath(`/jobs/${userJobId}`);
    return coverLetter;
  } catch (error) {
    console.error("[generateCoverLetter]", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to generate cover letter",
    );
  }
}

export async function saveCoverLetter(userJobId: string, coverLetter: string) {
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
      where: { id: userJobId, userId },
    });
    if (!userJob) throw new Error("Job not found");

    await prisma.userJob.update({
      where: { id: userJobId },
      data: { coverLetter },
    });

    revalidatePath(`/jobs/${userJobId}`);
  } catch (error) {
    console.error("[saveCoverLetter]", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save cover letter",
    );
  }
}
