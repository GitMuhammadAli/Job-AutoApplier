import { generateWithGroq } from "./groq";
import type { GenerateEmailInput } from "./ai-email-generator";

export async function generateCoverLetterFromInput(
  input: GenerateEmailInput
): Promise<string> {
  const lang = input.settings.emailLanguage || "English";
  const tone = input.settings.preferredTone || "professional";

  const systemPrompt = `You are an expert cover letter writer.

RULES:
- Write a concise cover letter (200-350 words)
- Structure: Opening hook → 2 key qualifications → why this company → closing
- NO generic phrases. Be specific to this job and this candidate.
- NO placeholder brackets — use the actual values provided.
- Tone: ${tone}
${lang !== "English" ? `- Write ENTIRELY in ${lang}` : ""}
${input.settings.customSystemPrompt ? `\nCUSTOM INSTRUCTIONS: ${input.settings.customSystemPrompt}` : ""}

Return ONLY the cover letter text. No JSON. No markdown fences. Just the letter.`;

  const userPrompt = `Job: ${input.job.title} at ${input.job.company}
Location: ${input.job.location || "Not specified"}
Skills: ${input.job.skills.join(", ") || "Not listed"}
Description: ${(input.job.description || "").slice(0, 1500)}

Candidate: ${input.profile.fullName}
${input.profile.experienceLevel ? `Experience: ${input.profile.experienceLevel}` : ""}
Resume "${input.resume.name}": ${(input.resume.content || "").slice(0, 1500)}
Skills: ${input.resume.detectedSkills.join(", ") || "Not specified"}

${input.settings.customClosing ? `Sign off with: ${input.settings.customClosing}` : ""}

Write the cover letter now.`;

  const coverLetter = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 600,
  });

  return coverLetter.trim();
}
