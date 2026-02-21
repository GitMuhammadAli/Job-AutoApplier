import { generateWithGroq } from "./groq";
import { z } from "zod";

function sanitizeForPrompt(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/gi, "[filtered]")
    .replace(/\b(system|assistant|user)\s*:/gi, "[filtered]:")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .slice(0, 3000);
}

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
    source?: string | null;
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
- The email body MUST be between 120 and 200 words. This is a strict requirement — do NOT write fewer than 120 words.
- NO clichés: no "I am writing to express my interest", no "I am excited to apply"
- NO placeholder brackets like [Company] or {name} — use the ACTUAL values provided
- Mention 2-3 specific qualifications from the candidate's resume that match the job
- If the job description is empty or says "No description available", do NOT invent job requirements — focus on the job title, company, and candidate's own skills
- Include a clear call-to-action: request for interview, call, or next steps
- Keep it concise, confident, and specific to THIS job at THIS company
- The email should read like a real human wrote it, not a template
- Do NOT start with "Dear Hiring Manager" — use "Hi [actual company name] team" or similar
- End with candidate's full name
- Do NOT say "as advertised on your website" — if a source platform is given, reference it naturally (e.g. "I came across this role on LinkedIn")
- Do NOT fabricate where the job was found — only mention the source if provided`);

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
      `CLOSING: End the email with exactly this: "${input.settings.customClosing}". Do NOT add any other sign-off, name, or signature after this — the system will append one automatically.`
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

  const sourceName = input.job.source
    ? { indeed: "Indeed", linkedin: "LinkedIn", remotive: "Remotive", arbeitnow: "Arbeitnow", adzuna: "Adzuna", rozee: "Rozee.pk", "rozee.pk": "Rozee.pk", jsearch: "JSearch", google: "Google Jobs" }[input.job.source.toLowerCase()] || input.job.source
    : null;

  userParts.push(`JOB DETAILS:
Title: ${input.job.title}
Company: ${input.job.company}
Location: ${input.job.location || "Not specified"}
${sourceName ? `Found on: ${sourceName}` : ""}
${input.job.salary ? `Salary: ${input.job.salary}` : ""}
Skills Required: ${(input.job.skills ?? []).length > 0 ? (input.job.skills ?? []).join(", ") : "Not listed"}
Description: ${sanitizeForPrompt(input.job.description || "No description available")}`);

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
Skills: ${(input.resume.detectedSkills ?? []).join(", ") || "Not specified"}
Content Preview: ${sanitizeForPrompt((input.resume.content || "").slice(0, 1500))}`);

  if (input.template?.body) {
    userParts.push(`\nUSER'S PREFERRED TEMPLATE STYLE (use as inspiration, not copy):
Subject: ${input.template.subject || ""}
Body: ${input.template.body.slice(0, 500)}`);
  }

  userParts.push("\nGenerate the application email now. Return ONLY JSON.");

  let parsed = await generateAndParseEmail(systemPrompt, userParts.join("\n"));

  const wordCount = parsed.body.split(/\s+/).filter(Boolean).length;
  if (wordCount < 100) {
    const retryPrompt = userParts.join("\n") +
      `\n\nIMPORTANT: Your previous response was only ${wordCount} words. The email body MUST be at least 120 words. Write a more detailed email with specific qualifications and a compelling pitch.`;
    parsed = await generateAndParseEmail(systemPrompt, retryPrompt);
  }

  const validated = EmailOutputSchema.parse(parsed);

  let { subject, body } = validated;
  subject = replacePlaceholders(subject, input);
  body = replacePlaceholders(body, input);

  if (input.settings.defaultSignature) {
    // Avoid duplicating the signature if the AI already included the closing
    const sigNorm = input.settings.defaultSignature.replace(/\s+/g, " ").trim().toLowerCase();
    const bodyTail = body.slice(-200).replace(/\s+/g, " ").trim().toLowerCase();
    const alreadyPresent = sigNorm.length > 5 && bodyTail.includes(sigNorm);

    if (!alreadyPresent) {
      // If customClosing was used, the AI already wrote a sign-off — only
      // append the signature if it adds something the closing didn't cover
      if (input.settings.customClosing) {
        const closingNorm = input.settings.customClosing.replace(/\s+/g, " ").trim().toLowerCase();
        if (closingNorm !== sigNorm) {
          body = body.trim() + "\n\n" + input.settings.defaultSignature;
        }
      } else {
        body = body.trim() + "\n\n" + input.settings.defaultSignature;
      }
    }
  }

  return { subject, body, coverLetter: null };
}

async function generateAndParseEmail(
  systemPrompt: string,
  userPrompt: string
): Promise<{ subject: string; body: string }> {
  const rawResponse = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 800,
  });

  try {
    let cleaned = rawResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      cleaned = cleaned.replace(/(?<=:\s*")([\s\S]*?)(?="(?:\s*[,}]))/g, (match) =>
        match.replace(/\r?\n/g, "\\n")
      );
      return JSON.parse(cleaned);
    }
  } catch {
    const subjectMatch = rawResponse.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bodyMatch = rawResponse.match(/"body"\s*:\s*"([\s\S]*)"?\s*\}?\s*$/);
    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        body: bodyMatch[1]
          .replace(/"\s*\}?\s*$/, "")
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"'),
      };
    }
    console.error("[AI Email] JSON parse failed, raw:", rawResponse.slice(0, 200));
    throw new Error("AI returned invalid JSON. Please try regenerating.");
  }
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
