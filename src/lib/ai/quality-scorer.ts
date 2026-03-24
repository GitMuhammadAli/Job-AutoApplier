import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface QualityScore {
  overall: number;
  criteria: {
    keywordMatch: number;
    personalization: number;
    length: number;
    tone: number;
    callToAction: number;
  };
  issues: string[];
  suggestions: string[];
}

export async function scoreApplication(
  emailBody: string,
  jobDescription: string,
  company: string,
): Promise<QualityScore> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `Score each criterion 1-10:
- keywordMatch: Does the email mention skills/tech from the JD?
- personalization: Does it reference the specific company?
- length: Is it concise (100-200 words ideal)?
- tone: Professional but not robotic?
- callToAction: Does it ask for next step?
Return JSON: {"overall":7,"criteria":{"keywordMatch":8,"personalization":6,"length":7,"tone":8,"callToAction":5},"issues":["..."],"suggestions":["..."]}`,
      },
      {
        role: "user",
        content: `Company: ${company}\n\nJD:\n${jobDescription.slice(0, 2000)}\n\nEmail:\n${emailBody}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(completion.choices[0]?.message?.content ?? "{}") as QualityScore;
  } catch {
    return {
      overall: 5,
      criteria: { keywordMatch: 5, personalization: 5, length: 5, tone: 5, callToAction: 5 },
      issues: ["Could not analyze"],
      suggestions: [],
    };
  }
}
