import { generateWithGroq } from "./groq";
import { z } from "zod";

const EmailOutputSchema = z.object({
  subject: z.string().min(5).max(200),
  body: z.string().min(50).max(3000),
});

export interface GenerateEmailInput {
  job: {
    title: string;
    company: string;
    location: string | null;
    salary: string | null;
    skills: string[];
    description: string | null;
  };
  profile: {
    fullName: string;
    experienceLevel: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    includeLinkedin: boolean;
    includeGithub: boolean;
    includePortfolio: boolean;
  };
  resume: {
    name: string;
    content: string | null;
    detectedSkills: string[];
  };
  settings: {
    preferredTone: string | null;
    emailLanguage: string | null;
    customClosing: string | null;
    customSystemPrompt: string | null;
    defaultSignature: string | null;
  };
  template: {
    subject: string | null;
    body: string | null;
  } | null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  coverLetter: string | null;
}

export async function generateApplicationEmail(
  input: GenerateEmailInput
): Promise<GeneratedEmail> {
  const systemParts: string[] = [];

  systemParts.push(`You are an expert job application email writer.

RULES:
- Write a professional application email (150-250 words)
- NO clichés: no "I am writing to express my interest", no "I am excited to apply"
- NO placeholder brackets like [Company] or {name} — use the ACTUAL values provided
- Mention 2-3 specific qualifications from the candidate's resume that match the job
- Include a clear call-to-action: request for interview, call, or next steps
- Keep it concise, confident, and specific to THIS job at THIS company
- The email should read like a real human wrote it, not a template
- Do NOT start with "Dear Hiring Manager" — use "Hi [actual company name] team" or similar
- End with candidate's full name`);

  const tone = input.settings.preferredTone || "professional";
  const toneInstructions: Record<string, string> = {
    professional:
      "Write in a professional, polished tone. Formal but not stiff.",
    confident:
      "Write with confidence and authority. Show you're the right fit.",
    friendly:
      "Write in a warm, approachable tone. Like talking to a future colleague.",
    casual: "Write casually but still professionally. Relaxed and direct.",
    formal: "Write in a traditional, structured formal tone.",
  };
  systemParts.push(
    `TONE: ${toneInstructions[tone] || toneInstructions.professional}`
  );

  if (
    input.settings.emailLanguage &&
    input.settings.emailLanguage !== "English"
  ) {
    systemParts.push(
      `LANGUAGE: Write the ENTIRE email in ${input.settings.emailLanguage}. Not just the greeting — everything.`
    );
  }

  if (input.settings.customClosing) {
    systemParts.push(
      `CLOSING: End the email with exactly this: "${input.settings.customClosing}"`
    );
  }

  if (input.settings.customSystemPrompt) {
    systemParts.push(
      `\nCUSTOM INSTRUCTIONS FROM THE USER (FOLLOW THESE CLOSELY):\n${input.settings.customSystemPrompt}`
    );
  }

  systemParts.push(`\nOUTPUT FORMAT:
Return ONLY valid JSON. No markdown, no backticks, no explanation.
{"subject":"Email subject line here","body":"Full email body here"}`);

  const systemPrompt = systemParts.join("\n\n");

  const userParts: string[] = [];

  userParts.push(`JOB DETAILS:
Title: ${input.job.title}
Company: ${input.job.company}
Location: ${input.job.location || "Not specified"}
${input.job.salary ? `Salary: ${input.job.salary}` : ""}
Skills Required: ${input.job.skills.length > 0 ? input.job.skills.join(", ") : "Not listed"}
Description: ${(input.job.description || "No description available").slice(0, 2000)}`);

  const profileParts = [`Name: ${input.profile.fullName}`];
  if (input.profile.experienceLevel)
    profileParts.push(`Experience: ${input.profile.experienceLevel}`);
  if (input.profile.includeLinkedin && input.profile.linkedinUrl)
    profileParts.push(`LinkedIn: ${input.profile.linkedinUrl}`);
  if (input.profile.includeGithub && input.profile.githubUrl)
    profileParts.push(`GitHub: ${input.profile.githubUrl}`);
  if (input.profile.includePortfolio && input.profile.portfolioUrl)
    profileParts.push(`Portfolio: ${input.profile.portfolioUrl}`);
  userParts.push(`\nCANDIDATE PROFILE:\n${profileParts.join("\n")}`);

  userParts.push(`\nMATCHED RESUME: "${input.resume.name}"
Skills: ${input.resume.detectedSkills.join(", ") || "Not specified"}
Content Preview: ${(input.resume.content || "").slice(0, 1500)}`);

  if (input.template?.body) {
    userParts.push(`\nUSER'S PREFERRED TEMPLATE STYLE (use as inspiration, not copy):
Subject: ${input.template.subject || ""}
Body: ${input.template.body.slice(0, 500)}`);
  }

  userParts.push("\nGenerate the application email now. Return ONLY JSON.");

  const rawResponse = await generateWithGroq(systemPrompt, userParts.join("\n"), {
    temperature: 0.7,
    max_tokens: 800,
  });

  let parsed: { subject: string; body: string };
  try {
    const cleaned = rawResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[AI Email] JSON parse failed, raw:", rawResponse.slice(0, 200));
    throw new Error("AI returned invalid JSON. Please try regenerating.");
  }

  const validated = EmailOutputSchema.parse(parsed);

  let { subject, body } = validated;
  subject = replacePlaceholders(subject, input);
  body = replacePlaceholders(body, input);

  if (input.settings.defaultSignature) {
    body = body.trim() + "\n\n" + input.settings.defaultSignature;
  }

  return { subject, body, coverLetter: null };
}

function replacePlaceholders(
  text: string,
  input: GenerateEmailInput
): string {
  return text
    .replace(/\{\{company\}\}/gi, input.job.company)
    .replace(/\{\{position\}\}/gi, input.job.title)
    .replace(/\{\{name\}\}/gi, input.profile.fullName)
    .replace(/\{\{location\}\}/gi, input.job.location || "")
    .replace(/\{\{salary\}\}/gi, input.job.salary || "")
    .replace(/\[Company\]/g, input.job.company)
    .replace(/\[Position\]/g, input.job.title)
    .replace(/\[Name\]/g, input.profile.fullName)
    .replace(/\[Your Name\]/g, input.profile.fullName);
}
