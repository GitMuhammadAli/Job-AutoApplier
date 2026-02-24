import { generateWithGroq } from "./groq";
import type { GenerateEmailInput } from "./ai-email-generator";

function sanitizeForPrompt(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/gi, "[filtered]")
    .replace(/\b(system|assistant|user)\s*:/gi, "[filtered]:")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .slice(0, 3000);
}

export async function generatePitchFromInput(
  input: GenerateEmailInput,
): Promise<string> {
  const lang = input.settings.emailLanguage || "English";
  const tone = input.settings.preferredTone || "professional";

  const systemPrompt = `You are a job application pitch writer.

RULES:
- Write a SHORT pitch: exactly 3-4 sentences, under 80 words total.
- Purpose: this is for ATS form fields like "Why are you interested?" or "Tell us about yourself"
- First sentence: who you are (name, role, experience level)
- Second/third: 2 specific qualifications matching this job
- Last sentence: why this specific company/role excites you
- NO generic fluff. Be direct, specific, confident.
- NO placeholder brackets — use actual values.
- Tone: ${tone}
${lang !== "English" ? `- Write ENTIRELY in ${lang}` : ""}

Return ONLY the pitch text. No JSON. No markdown. Just the pitch.`;

  const userPrompt = `Job: ${input.job.title} at ${input.job.company}
Location: ${input.job.location || "Not specified"}
Skills: ${(input.job.skills ?? []).join(", ") || "Not listed"}
Description: ${sanitizeForPrompt((input.job.description || "").slice(0, 1000))}

Candidate: ${input.profile.fullName}
${input.profile.experienceLevel ? `Experience: ${input.profile.experienceLevel}` : ""}
Resume skills: ${(input.resume.detectedSkills ?? []).join(", ") || "Not specified"}

Write a 3-4 sentence pitch now.`;

  const pitch = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 200,
  });

  return pitch.trim();
}
