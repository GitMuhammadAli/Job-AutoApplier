import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

interface CoverLetterInput {
  jobTitle: string;
  company: string;
  jobDescription: string;
  location?: string | null;
  resumeContent: string;
  userName?: string | null;
  skills?: string | null;
  experienceLevel?: string | null;
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const prompt = `Write a professional, concise cover letter for the following job application. The tone should be confident but not arrogant. Keep it under 350 words. Do NOT include placeholder brackets like [Your Name] -- use the actual information provided.

Job Title: ${input.jobTitle}
Company: ${input.company}
Location: ${input.location || "Not specified"}
Job Description: ${input.jobDescription.substring(0, 1500)}

Applicant Info:
Name: ${input.userName || "the applicant"}
Experience Level: ${input.experienceLevel || "Not specified"}
Key Skills: ${input.skills || "See resume"}
Resume Content: ${input.resumeContent.substring(0, 2000)}

Write the cover letter now. Start directly with "Dear Hiring Manager," -- no subject line or headers.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
    max_tokens: 1024,
  });

  return completion.choices[0]?.message?.content || "Failed to generate cover letter. Please try again.";
}
