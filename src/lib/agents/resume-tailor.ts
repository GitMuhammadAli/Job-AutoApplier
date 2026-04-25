/**
 * Agent 2: Resume Tailor
 * Input: user's resume skills[], job description, job requirements
 * Output: { relevantSkills, bulletSuggestions, missingKeywords }
 * Compares skills to job description and suggests emphasis.
 */

import { generateWithGroq } from "@/lib/groq";

export interface TailoredResume {
  relevantSkills: string[];
  bulletSuggestions: string[];
  missingKeywords: string[];
}

export async function tailorResume(input: {
  userSkills: string[];
  jobDescription: string;
  jobTitle: string;
  jobRequirements?: string;
}): Promise<TailoredResume> {
  const { userSkills, jobDescription, jobTitle, jobRequirements } = input;

  const systemPrompt = `You are an expert resume tailor and ATS optimization specialist.
Analyze the candidate's skills against the job description and provide tailored recommendations.
Return ONLY valid JSON with no markdown or explanation.

JSON format:
{
  "relevantSkills": ["skill1", "skill2", "skill3"],
  "bulletSuggestions": ["bullet point suggestion 1", "bullet point suggestion 2", "bullet point suggestion 3"],
  "missingKeywords": ["keyword1", "keyword2", "keyword3"]
}

Guidelines:
- relevantSkills: Pick the 5-8 skills from the candidate's list that best match the JD. Order by relevance.
- bulletSuggestions: Write 3-5 achievement-oriented bullet points the candidate could add/emphasize. Use action verbs and quantify where possible.
- missingKeywords: List keywords/skills in the JD that the candidate is missing. Max 8.`;

  const sanitizedJD = jobDescription?.slice(0, 2000) ?? "No description provided";
  const sanitizedReqs = jobRequirements?.slice(0, 1000) ?? "";

  const userPrompt = `Job Title: ${jobTitle}

Job Description:
${sanitizedJD}

${sanitizedReqs ? `Job Requirements:\n${sanitizedReqs}\n` : ""}
Candidate Skills: ${userSkills.join(", ") || "Not specified"}

Analyze and return tailored resume recommendations as JSON.`;

  const raw = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.4,
    max_tokens: 700,
    model: "llama-3.3-70b-versatile",
  });

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as TailoredResume;
    return {
      relevantSkills: Array.isArray(parsed.relevantSkills) ? parsed.relevantSkills : [],
      bulletSuggestions: Array.isArray(parsed.bulletSuggestions) ? parsed.bulletSuggestions : [],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
    };
  } catch {
    // Fallback with basic matching
    const jdLower = (jobDescription ?? "").toLowerCase();
    const relevant = userSkills.filter((s) => jdLower.includes(s.toLowerCase())).slice(0, 8);
    return {
      relevantSkills: relevant.length > 0 ? relevant : userSkills.slice(0, 5),
      bulletSuggestions: [
        `Leveraged ${relevant[0] ?? "technical skills"} to deliver high-quality results`,
        "Collaborated with cross-functional teams to meet project deadlines",
        "Contributed to process improvements that increased team efficiency",
      ],
      missingKeywords: [],
    };
  }
}
