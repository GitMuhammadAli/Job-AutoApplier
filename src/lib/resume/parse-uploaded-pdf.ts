/**
 * Parse-uploaded-PDF helper — extracts the structured resume profile from an
 * uploaded Resume row's text content via Groq + Gemini fallback. Single source
 * of truth used by:
 *   1. POST /api/resumes/profile/parse-pdf  — explicit "review before save" wizard
 *   2. POST /api/resumes/generate           — fallback when structured profile gate fails
 *      (so the user can hit "Tailor for this JD" with only uploaded PDFs and no manual entry)
 *
 * Never persists — returns a validated ResumeProfile candidate.
 */

import { prisma } from "@/lib/prisma";
import { generateWithGroq } from "@/lib/groq";
import { ResumeProfileSchema, type ResumeProfile } from "@/lib/resume/types";

const SYSTEM_PROMPT = `You are a resume parser. Given the raw text of a resume, extract a STRICTLY structured JSON object with these fields:

{
  "header": {
    "fullName": string,
    "headline": string,
    "location": string (optional),
    "email": string,
    "phone": string (optional),
    "websiteUrl": string (optional, must be https://),
    "githubUrl": string (optional, must be https://),
    "linkedinUrl": string (optional, must be https://)
  },
  "summary": string,
  "skills": string[],
  "experiences": [{ "company": string, "title": string, "location": string?, "startDate": string, "endDate": string?, "bullets": string[] }],
  "projects":    [{ "title": string, "role": string?, "oneLiner": string, "bullets": string[], "stack": string[], "liveUrl": string?, "repoUrl": string? }],
  "education":   [{ "institution": string, "degree": string, "startDate": string?, "endDate": string?, "details": string? }],
  "certifications": [{ "name": string, "issuer": string?, "issuedDate": string?, "credentialUrl": string? }]
}

HARD RULES:
- Do NOT invent skills, projects, experiences, or any text not in the source.
- Do NOT rewrite or paraphrase bullets — copy verbatim.
- If a field isn't in the source, use empty string or omit.
- Return ONLY the JSON. No prose, no markdown fence.`;

interface ParsedCandidate {
  header: {
    fullName: string;
    headline: string;
    location?: string;
    email: string;
    phone?: string;
    websiteUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
  };
  summary?: string;
  skills: string[];
  experiences: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    bullets: string[];
  }>;
  projects: Array<{
    title: string;
    role?: string;
    oneLiner: string;
    bullets: string[];
    stack: string[];
    liveUrl?: string;
    repoUrl?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    startDate?: string;
    endDate?: string;
    details?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string;
    issuedDate?: string;
    credentialUrl?: string;
  }>;
}

export interface ParseResult {
  /** Validated profile if Zod parsed cleanly. Null if extraction failed entirely. */
  profile: ResumeProfile | null;
  /** Unvalidated shape — populated even if Zod fails so callers can show partial data. */
  raw: unknown;
  /** Zod validation issues, if any. */
  warnings: unknown[];
  /** Which Resume row was parsed. */
  resumeId: string;
  resumeName: string;
}

export async function parseUploadedPdfToProfile(
  resumeId: string,
  userId: string,
): Promise<ParseResult> {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId, isDeleted: false },
  });
  if (!resume) {
    throw new Error("Resume not found");
  }
  if (!resume.content || resume.content.length < 100) {
    throw new Error("Resume has no extractable text. Try re-parsing the PDF first.");
  }

  const raw = await generateWithGroq(
    SYSTEM_PROMPT,
    `Resume text:\n\n${resume.content.slice(0, 12_000)}`,
    { temperature: 0.1, max_tokens: 2000 },
  );

  const jsonText = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? raw;
  let candidate: ParsedCandidate;
  try {
    candidate = JSON.parse(jsonText.trim());
  } catch {
    throw new Error("AI returned non-JSON output. Try again or fill manually.");
  }

  const summaries = candidate.summary
    ? [
        {
          label: "Default",
          content: candidate.summary.slice(0, 600),
          isDefault: true,
        },
      ]
    : [];

  const shaped = {
    header: candidate.header,
    skills: (candidate.skills ?? []).map((s) => s.slice(0, 64)).slice(0, 80),
    skillsLocked: false,
    summaries,
    experiences: (candidate.experiences ?? []).map((e, idx) => ({
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: (e.bullets ?? []).map((b) => b.slice(0, 280)).slice(0, 8),
      order: idx,
    })),
    projects: (candidate.projects ?? []).map((p, idx) => ({
      title: p.title,
      role: p.role,
      oneLiner: (p.oneLiner ?? "").slice(0, 200),
      bullets: (p.bullets ?? []).map((b) => b.slice(0, 280)).slice(0, 6),
      stack: (p.stack ?? []).map((s) => s.slice(0, 64)).slice(0, 20),
      liveUrl: p.liveUrl,
      repoUrl: p.repoUrl,
      isFeatured: false,
      order: idx,
    })),
    education: (candidate.education ?? []).map((e, idx) => ({
      institution: e.institution,
      degree: e.degree,
      startDate: e.startDate,
      endDate: e.endDate,
      details: e.details,
      order: idx,
    })),
    certifications: (candidate.certifications ?? []).map((c, idx) => ({
      name: c.name,
      issuer: c.issuer,
      issuedDate: c.issuedDate,
      credentialUrl: c.credentialUrl,
      order: idx,
    })),
  };

  const validation = ResumeProfileSchema.safeParse(shaped);
  return {
    profile: validation.success ? validation.data : null,
    raw: shaped,
    warnings: validation.success ? [] : validation.error.issues.slice(0, 10),
    resumeId: resume.id,
    resumeName: resume.name,
  };
}

/**
 * Picks the user's "best" uploaded PDF for fallback parsing — but ONLY
 * resumes that actually have extractable text. Returns top N candidates
 * so the caller can try the next one if the first fails AI parsing.
 *
 * Why a list, not a single pick:
 *   Older code returned just the user's default upload. If their default
 *   was one of the "No content" PDFs (image-only scan, broken extraction,
 *   etc), the whole tailor pipeline failed immediately with "Resume has
 *   no extractable text" — never trying the other 6 uploads that did
 *   have content. Now we return up to N candidates and the caller loops.
 *
 * Filter: content length ≥ 100 chars AND textQuality is not "empty".
 *         (textQuality is set during upload; "empty" / "poor" / "good".)
 * Order:  isDefault desc → textQuality (good before poor) → createdAt desc.
 *
 * Returns empty array when no upload has parseable text. Caller should
 * surface a "re-parse your PDFs first" message in that case.
 */
export async function pickBestUploadsForParse(
  userId: string,
  take = 3,
): Promise<Array<{ id: string; name: string; textQuality: string | null }>> {
  return prisma.resume.findMany({
    where: {
      userId,
      isDeleted: false,
      content: { not: null },
      // Length filter via raw can't be done in Prisma where; we filter in JS
      // below. textQuality != "empty" knocks out the worst offenders.
      textQuality: { not: "empty" },
    },
    orderBy: [
      { isDefault: "desc" },
      // textQuality "good" sorts before "poor" alphabetically by accident;
      // explicit ordering would need a $queryRaw. JS sorts the small list
      // for clarity below.
      { createdAt: "desc" },
    ],
    select: { id: true, name: true, content: true, textQuality: true },
  }).then((rows) =>
    rows
      .filter((r) => (r.content?.length ?? 0) >= 100)
      .sort((a, b) => {
        // Promote "good" over "poor"; tiebreak preserved from DB order.
        const aQ = a.textQuality === "good" ? 0 : 1;
        const bQ = b.textQuality === "good" ? 0 : 1;
        return aQ - bQ;
      })
      .slice(0, take)
      .map(({ id, name, textQuality }) => ({ id, name, textQuality })),
  );
}

/**
 * Backwards-compatible single-pick wrapper. Returns the first usable
 * upload or null. New code should prefer the list version above.
 */
export async function pickBestUploadForParse(
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const candidates = await pickBestUploadsForParse(userId, 1);
  return candidates[0] ? { id: candidates[0].id, name: candidates[0].name } : null;
}

/**
 * Whether a ResumeProfile passes the minimum gate (used by generate + auto-attach).
 * Hoisted into the helper so the gate definition lives in one place.
 */
export function passesProfileGate(profile: ResumeProfile): boolean {
  return (
    profile.header.fullName.trim().length > 0 &&
    profile.header.email.trim().length > 0 &&
    (profile.experiences.length > 0 || profile.projects.length > 0)
  );
}
