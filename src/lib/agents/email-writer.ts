/**
 * Agent 3: Email Writer
 * Input: company research, tailored resume, job details, user name
 * Output: { subject, body, coverLetter }
 * Writes a personalized application email using context from agents 1 and 2.
 */

import { generateWithGroq } from "@/lib/groq";
import type { CompanyResearch } from "./researcher";
import type { TailoredResume } from "./resume-tailor";

export interface ApplicationEmail {
  subject: string;
  body: string;
  coverLetter: string;
}

export async function writeApplicationEmail(input: {
  companyResearch: CompanyResearch;
  tailoredResume: TailoredResume;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  userName: string;
  userEmail: string;
}): Promise<ApplicationEmail> {
  const {
    companyResearch,
    tailoredResume,
    jobTitle,
    companyName,
    jobDescription,
    userName,
    userEmail,
  } = input;

  const systemPrompt = `You are an expert job application email and cover letter writer.
Write a personalized, compelling application email using the company research and tailored resume provided.

RULES:
- Email body: 100-150 words, punchy and specific to THIS company
- NO clichés: no "I am writing to express my interest", no "I am excited to apply"
- Reference the company's mission/values/culture naturally to show genuine interest
- Mention 2-3 specific skills that match the job
- Include a clear call-to-action (request for interview/call)
- Do NOT start with "Dear Hiring Manager" — use "Hi ${companyName} team," or similar
- Sign off with the candidate's actual name
- Cover letter: 200-300 words, more detailed, referencing company culture and specific achievements
- The cover letter should tell a brief story connecting the candidate's background to the company's mission

Return ONLY valid JSON with no markdown or explanation:
{
  "subject": "email subject line",
  "body": "full email body",
  "coverLetter": "full cover letter text"
}`;

  const topSkills = tailoredResume.relevantSkills.slice(0, 5).join(", ");
  const values = companyResearch.values.slice(0, 3).join(", ");
  const techStack = companyResearch.techStack.slice(0, 5).join(", ");

  const userPrompt = `Job Title: ${jobTitle}
Company: ${companyName}
Candidate Name: ${userName}
Candidate Email: ${userEmail}

Company Research:
- Mission: ${companyResearch.mission}
- Values: ${values || "Not found"}
- Tech Stack: ${techStack || "Not found"}
- Culture: ${companyResearch.culture}
- Recent News: ${companyResearch.recentNews}

Candidate's Top Matching Skills: ${topSkills || "Not specified"}
Bullet Point Achievements:
${tailoredResume.bulletSuggestions.slice(0, 3).map((b) => `- ${b}`).join("\n")}

Job Description (excerpt):
${jobDescription.slice(0, 800)}

Write the application email and cover letter. Return ONLY JSON.`;

  const raw = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 1200,
    model: "llama-3.1-8b-instant",
  });

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    // Handle literal newlines inside JSON strings
    let fixedJson = cleaned;
    try {
      JSON.parse(cleaned);
    } catch {
      fixedJson = cleaned.replace(
        /(?<=:\s*")([\s\S]*?)(?="(?:\s*[,}]))/g,
        (match) => match.replace(/\r?\n/g, "\\n")
      );
    }

    const parsed = JSON.parse(fixedJson) as ApplicationEmail;
    return {
      subject: parsed.subject ?? `Application for ${jobTitle} at ${companyName}`,
      body: parsed.body ?? "",
      coverLetter: parsed.coverLetter ?? "",
    };
  } catch {
    // Fallback email
    return {
      subject: `Application for ${jobTitle} at ${companyName}`,
      body: `Hi ${companyName} team,

I'm ${userName}, applying for the ${jobTitle} role. With expertise in ${topSkills || "the required skills"}, I'm confident I can contribute to ${companyResearch.mission || "your team's goals"}.

Please find my resume attached. I'd love to discuss how my background aligns with your needs.

Best regards,
${userName}`,
      coverLetter: `Dear ${companyName} Hiring Team,

I am writing to apply for the ${jobTitle} position. Your company's commitment to ${values || "excellence and innovation"} resonates deeply with my professional values.

With skills in ${topSkills || "the relevant technologies"}, I have built a track record of delivering results. I am eager to bring this expertise to ${companyName}.

Thank you for considering my application.

Sincerely,
${userName}`,
    };
  }
}
