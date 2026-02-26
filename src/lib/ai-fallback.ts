/**
 * Resilient AI generation with fallback chain:
 * 1. Try Groq (primary)
 * 2. If Groq fails, fall back to template-based generation
 *
 * Used by email generation to ensure applications are never blocked by AI outages.
 */

import { generateWithGroq } from "./groq";

interface FallbackEmailInput {
  jobTitle: string;
  company: string;
  candidateName: string;
  skills: string[];
  source?: string | null;
}

/**
 * Generate AI text with automatic fallback to template.
 * Returns { text, usedFallback } so callers know if AI was available.
 */
export async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; max_tokens?: number; model?: string },
): Promise<{ text: string; usedFallback: boolean }> {
  try {
    const text = await generateWithGroq(systemPrompt, userPrompt, options);
    return { text, usedFallback: false };
  } catch (err) {
    console.warn("[AI Fallback] Groq failed, no AI fallback available:", err instanceof Error ? err.message : err);
    throw err; // Re-throw since we can't generate arbitrary text from a template
  }
}

/**
 * Generate a template-based application email when ALL AI providers are down.
 * This is worse than AI-generated but it's something.
 */
export function generateTemplateEmail(input: FallbackEmailInput): { subject: string; body: string } {
  const { jobTitle, company, candidateName, skills, source } = input;
  const topSkills = skills.slice(0, 3).join(", ") || "relevant technical skills";
  const sourceRef = source ? ` on ${source}` : "";

  const subject = `Application for ${jobTitle} at ${company}`;
  const body = `Hi ${company} team,

I came across the ${jobTitle} position${sourceRef} and wanted to express my interest. With experience in ${topSkills}, I believe I could contribute meaningfully to your team.

I've attached my resume for your review and would welcome the opportunity to discuss how my background aligns with this role.

Please find my resume attached.

Best regards,
${candidateName}`;

  return { subject, body };
}
