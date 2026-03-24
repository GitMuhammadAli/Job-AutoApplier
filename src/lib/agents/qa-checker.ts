/**
 * Agent 4: QA Checker
 * Input: email subject+body, JD, company name
 * Output: { score: 1-10, issues: string[], suggestions: string[], spamScore: number }
 * Checks tone, keyword density, personalization, and spam triggers.
 */

import { generateWithGroq } from "@/lib/groq";

export interface QAResult {
  score: number;
  issues: string[];
  suggestions: string[];
  spamScore: number;
}

export async function checkApplicationQuality(input: {
  subject: string;
  body: string;
  jobDescription: string;
  companyName: string;
}): Promise<QAResult> {
  const { subject, body, jobDescription, companyName } = input;

  const systemPrompt = `You are a senior recruiting expert and email deliverability specialist.
Evaluate the quality of this job application email.

Score criteria (1-10):
- 9-10: Highly personalized, strong match, excellent tone, clean deliverability
- 7-8: Good personalization, solid content, minor issues
- 5-6: Average, generic content, some spam risks
- 1-4: Poor quality, major issues, likely to be filtered or ignored

Spam score (0-10, where 0=clean, 10=high spam risk):
Check for: excessive capitalization, spam trigger words (FREE, URGENT, GUARANTEED), over-punctuation (!!!), misleading subject lines, excessive links

Return ONLY valid JSON with no markdown or explanation:
{
  "score": 8,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "spamScore": 2
}

Keep issues and suggestions to 3-5 items max. Be specific and actionable.`;

  const sanitizedBody = body.slice(0, 1500);
  const sanitizedJD = jobDescription.slice(0, 800);

  const userPrompt = `Company: ${companyName}

Email Subject: ${subject}

Email Body:
${sanitizedBody}

Job Description (excerpt):
${sanitizedJD}

Evaluate this application email. Return ONLY JSON.`;

  const raw = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.3,
    max_tokens: 500,
    model: "llama-3.1-8b-instant",
  });

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as QAResult;

    const score = Math.min(10, Math.max(1, Math.round(Number(parsed.score) || 5)));
    const spamScore = Math.min(10, Math.max(0, Math.round(Number(parsed.spamScore) || 0)));

    return {
      score,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 5) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      spamScore,
    };
  } catch {
    // Fallback: do basic local checks
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (body.length < 100) issues.push("Email body is too short");
    if (body.length > 2000) issues.push("Email body is too long");
    if (!body.toLowerCase().includes(companyName.toLowerCase())) {
      issues.push("Email does not mention the company name");
    }
    if (subject.length < 10) issues.push("Subject line is too short");

    if (issues.length === 0) suggestions.push("Email looks good overall");
    else suggestions.push("Review and address the listed issues before sending");

    return {
      score: issues.length === 0 ? 7 : Math.max(1, 7 - issues.length * 2),
      issues,
      suggestions,
      spamScore: 2,
    };
  }
}
