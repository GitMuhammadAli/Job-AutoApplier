"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function generateCoverLetter(userJobId: string) {
  const userId = await getAuthUserId();

  const userJob = await prisma.userJob.findFirst({
    where: { id: userJobId, userId },
    include: { globalJob: true },
  });
  if (!userJob) throw new Error("Job not found");

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

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
  const closing = settings?.customClosing || "Looking forward to hearing from you";

  const links: string[] = [];
  if (settings?.includeLinkedin && settings.linkedinUrl) links.push(`LinkedIn: ${settings.linkedinUrl}`);
  if (settings?.includeGithub && settings.githubUrl) links.push(`GitHub: ${settings.githubUrl}`);
  if (settings?.includePortfolio && settings.portfolioUrl) links.push(`Portfolio: ${settings.portfolioUrl}`);

  const systemPrompt = `You are an expert job application cover letter writer. Write in ${lang} with a ${tone} tone.
${customPrompt ? `Additional instructions: ${customPrompt}` : ""}
Write a concise cover letter (150-250 words) that:
- Opens with genuine interest in the specific role and company
- Highlights 2-3 relevant skills/experiences that match the job
- Shows knowledge of what the company does if possible
- Ends with a clear call to action
- Sounds human, not generic or AI-generated
Do NOT use placeholder brackets like [Your Name]. Use the actual name provided.`;

  const userPrompt = `Write a cover letter for:

Position: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
${job.description ? `Job Description (first 1500 chars): ${job.description.slice(0, 1500)}` : ""}
${job.skills.length > 0 ? `Required Skills: ${job.skills.join(", ")}` : ""}

Applicant: ${name}
${bestResume?.content ? `Resume Summary: ${bestResume.content.slice(0, 1000)}` : ""}
${links.length > 0 ? `Links: ${links.join(" | ")}` : ""}

Sign off with: ${closing}
Applicant name: ${name}`;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured. Add it in Vercel env vars.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
  });

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
}

export async function saveCoverLetter(userJobId: string, coverLetter: string) {
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
}
