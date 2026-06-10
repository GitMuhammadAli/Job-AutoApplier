/**
 * Agent 2: Resume Tailor
 *
 * Input:  user's skills[], JD text
 * Output: relevantSkills (direct matches) + adjacentMatches (close-enough)
 *         + missingKeywords (genuine gaps) + bulletSuggestions (emphasis hints)
 *
 * The adjacency awareness lets the downstream renderer surface "you have REST
 * APIs which is adjacent to JD's GraphQL ask" instead of marking it missing
 * outright. Adjacencies stay strictly within things the user actually does;
 * no fabrication.
 */

import { generateWithGroq } from "@/lib/groq";

export interface AdjacentMatch {
  /** JD requirement that has no direct user-skill match. */
  jdAsks: string;
  /** User's existing skill that's close enough to mention. */
  userHas: string;
  /** Model's self-check — flag dropped on render if false. */
  honest: boolean;
}

export interface TailoredResume {
  relevantSkills: string[];
  /** New: adjacent skills the user has that map to JD requirements. */
  adjacentMatches: AdjacentMatch[];
  bulletSuggestions: string[];
  /** Genuine gaps — no direct OR adjacent path from user's profile. */
  missingKeywords: string[];
}

export async function tailorResume(input: {
  userSkills: string[];
  jobDescription: string;
  jobTitle: string;
  jobRequirements?: string;
  /** Pass to enforce per-user token quota. Routes call sites should always pass it. */
  quota?: { userId: string; route: string };
}): Promise<TailoredResume> {
  const { userSkills, jobDescription, jobTitle, jobRequirements } = input;

  const systemPrompt = `You are an honest resume tailor + ATS optimization specialist.
You are tailoring a real candidate's resume — you NEVER fabricate skills, projects,
or experience they don't have. Your job is to help them present what they ACTUALLY
have in the most JD-aligned way possible. Return ONLY valid JSON.

JSON format:
{
  "relevantSkills": ["skill1", "skill2"],         // STRICT subset of candidate's input skills, JD-ordered
  "adjacentMatches": [                            // skills user HAS that are adjacent to JD requirements
    {"jdAsks": "GraphQL", "userHas": "REST APIs", "honest": true}
  ],
  "bulletSuggestions": ["…"],                     // emphasis hints only, never new claims
  "missingKeywords": ["keyword1", "keyword2"]     // JD-required terms with NO match (direct or adjacent) in profile
}

Hard rules:
- relevantSkills MUST be a subset of the candidate's input skills. Do NOT add new ones.
- adjacentMatches: when the JD asks for X and the candidate has Y (related tech, same
  domain), surface it. Honest adjacencies only — REST → GraphQL is fine (both APIs);
  REST → Kubernetes is not. This is what lets the candidate's existing experience get
  credit for related work.
- bulletSuggestions: ONLY suggest framing/emphasis of existing experience. Never invent
  achievements.
- missingKeywords: ONLY include items the candidate has NO honest path to — neither
  direct nor adjacent. If user has React and JD wants "modern frontend frameworks",
  that's NOT missing — it's adjacent.

The downstream pipeline runs a strict audit that rejects ANY word in the rendered PDF
not present in the candidate's profile. Be precise — fabrication costs the candidate
a retry.`;

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
    max_tokens: 900,
    model: "llama-3.3-70b-versatile",
    quota: input.quota,
  });

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as TailoredResume;
    const adjacents = Array.isArray(parsed.adjacentMatches) ? parsed.adjacentMatches : [];
    // Drop any adjacency the model flagged as not honest, or where userHas
    // isn't actually one of the user's input skills.
    const userSkillsLower = new Set(userSkills.map((s) => s.toLowerCase().trim()));
    const filteredAdjacents = adjacents.filter(
      (a): a is AdjacentMatch =>
        a != null &&
        typeof a.jdAsks === "string" &&
        typeof a.userHas === "string" &&
        a.honest !== false &&
        userSkillsLower.has(a.userHas.toLowerCase().trim()),
    );
    return {
      relevantSkills: Array.isArray(parsed.relevantSkills) ? parsed.relevantSkills : [],
      adjacentMatches: filteredAdjacents,
      bulletSuggestions: Array.isArray(parsed.bulletSuggestions) ? parsed.bulletSuggestions : [],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
    };
  } catch {
    const jdLower = (jobDescription ?? "").toLowerCase();
    const relevant = userSkills.filter((s) => jdLower.includes(s.toLowerCase())).slice(0, 8);
    return {
      relevantSkills: relevant.length > 0 ? relevant : userSkills.slice(0, 5),
      adjacentMatches: [],
      bulletSuggestions: [
        `Leveraged ${relevant[0] ?? "technical skills"} to deliver high-quality results`,
        "Collaborated with cross-functional teams to meet project deadlines",
        "Contributed to process improvements that increased team efficiency",
      ],
      missingKeywords: [],
    };
  }
}
