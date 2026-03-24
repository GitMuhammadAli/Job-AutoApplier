/**
 * AI follow-up email generator.
 * Input: original email subject + body, job title, company name, days since applied.
 * Output: { subject: string, body: string }
 *
 * Generates a polite, short (3-4 sentences) follow-up referencing the original
 * application, the specific role, and includes a call to action.
 */

import { generateWithGroq } from "@/lib/groq";

export interface GenerateFollowUpInput {
  originalSubject: string;
  originalBody: string;
  jobTitle: string;
  companyName: string;
  daysSinceApplied: number;
  emailLanguage?: string | null;
}

export interface GeneratedFollowUp {
  subject: string;
  body: string;
}

export async function generateFollowUpEmail(
  input: GenerateFollowUpInput
): Promise<GeneratedFollowUp> {
  const { originalSubject, originalBody, jobTitle, companyName, daysSinceApplied, emailLanguage } = input;

  const langInstruction =
    emailLanguage && emailLanguage !== "English"
      ? `Write entirely in ${emailLanguage}.`
      : "";

  const systemPrompt = `You are a professional follow-up email writer helping job candidates follow up on their applications.

RULES:
- Write a SHORT, polite follow-up: exactly 3-4 sentences in the body. No more.
- Reference the original application naturally (the role and company).
- Mention how many days ago you applied only if it's natural — do NOT sound desperate.
- End with a clear call to action (e.g. ask if there's an update on the timeline, or express continued interest and availability to chat).
- Do NOT use clichés like "I hope this email finds you well" or "I am writing to follow up".
- Do NOT repeat the full original email. Just a brief, warm check-in.
- The subject line should start with "Re:" followed by the original subject so it threads correctly.
- Return ONLY valid JSON. No markdown, no backticks, no explanation.
${langInstruction}

OUTPUT FORMAT:
{"subject":"Re: <original subject>","body":"<follow-up body>"}`;

  const userPrompt = `Job: ${jobTitle} at ${companyName}
Applied: ${daysSinceApplied} day${daysSinceApplied === 1 ? "" : "s"} ago
Original subject: ${originalSubject}
Original email preview: ${originalBody.slice(0, 400)}

Write a brief follow-up email. Return ONLY JSON.`;

  const raw = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.5,
    max_tokens: 300,
    model: "llama-3.1-8b-instant",
  });

  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { subject: string; body: string };
    return {
      subject: parsed.subject ?? `Re: ${originalSubject}`,
      body: parsed.body ?? cleaned,
    };
  } catch {
    // Regex fallback
    const subjectMatch = cleaned.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bodyMatch = cleaned.match(/"body"\s*:\s*"([\s\S]*)"\s*\}?\s*$/);
    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        body: bodyMatch[1]
          .replace(/"\s*\}?\s*$/, "")
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"'),
      };
    }
    throw new Error("Follow-up AI returned invalid format");
  }
}
