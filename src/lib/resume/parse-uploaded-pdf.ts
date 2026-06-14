/**
 * Parse-uploaded-PDF helper — extracts the structured resume profile from an
 * uploaded Resume row's text content via a resilience chain:
 *
 *   cached profile  →  Groq LLM  →  Gemini LLM  →  regex heuristic
 *
 * Single source of truth used by:
 *   1. POST /api/resumes/profile/parse-pdf  — explicit "review before save" wizard
 *   2. POST /api/resumes/generate           — fallback when structured profile gate fails
 *      (so the user can hit "Tailor for this JD" with only uploaded PDFs and no manual entry)
 *
 * Caching:
 *   Successful LLM parses are written to `Resume.parsedProfile` + `parsedProfileAt`
 *   so the next call within `CACHE_TTL_MS` returns instantly. The heuristic strategy
 *   is NEVER cached (it's a degraded last-resort path; the user should review and
 *   re-trigger a real parse).
 *
 * Persistence:
 *   Only the cache columns above are written. The Resume's denormalized children
 *   (experiences, projects, education, etc.) remain unchanged — the caller decides
 *   when/if to materialize them into ResumeExperience/ResumeProject rows.
 */

import { prisma } from "@/lib/prisma";
import { generateWithGroq } from "@/lib/groq";
import { ResumeProfileSchema, type ResumeProfile } from "@/lib/resume/types";
import synonyms from "@/lib/resume/synonyms.json";

/** Cached `Resume.parsedProfile` rows are considered fresh for 30 days. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

export type ParseStrategy = "cache" | "groq" | "gemini" | "heuristic";

export interface ParseResult {
  /** Validated profile if Zod parsed cleanly. Null if extraction failed entirely. */
  profile: ResumeProfile | null;
  /** Unvalidated shape — populated even if Zod fails so callers can show partial data. */
  raw: unknown;
  /**
   * Human-readable warnings (e.g. "Used heuristic parser…") combined with raw
   * Zod issues. Callers can `.filter((w) => typeof w === "string")` to surface
   * to end users without exposing validation internals.
   */
  warnings: unknown[];
  /** Which path actually produced the profile in this call. */
  strategy: ParseStrategy;
  /** Which Resume row was parsed. */
  resumeId: string;
  resumeName: string;
}

/**
 * Runs the LLM extraction prompt against a single provider callable and shapes
 * the result. Throws on transport failure, parse failure, or empty output —
 * the outer chain decides whether to fall through to the next strategy.
 */
async function runLlmExtraction(
  callLlm: (system: string, user: string) => Promise<string>,
  content: string,
): Promise<ParsedCandidate> {
  const raw = await callLlm(
    SYSTEM_PROMPT,
    `Resume text:\n\n${content.slice(0, 12_000)}`,
  );
  const jsonText = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? raw;
  const parsed = JSON.parse(jsonText.trim()) as ParsedCandidate;
  if (!parsed || typeof parsed !== "object" || !parsed.header) {
    throw new Error("LLM returned malformed JSON (no header)");
  }
  return parsed;
}

/**
 * Direct Gemini call — mirrors the inline fallback in `lib/groq.ts` but is
 * invoked explicitly so we can attribute the `strategy: "gemini"` outcome.
 */
async function generateWithGeminiDirect(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini not configured (set GOOGLE_AI_API_KEY)");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

/**
 * Shape an extracted candidate into the ResumeProfile-compatible structure
 * applied length caps. Returned as-is when we already have a cached profile.
 */
function shapeCandidate(candidate: ParsedCandidate) {
  const summaries = candidate.summary
    ? [
        {
          label: "Default",
          content: candidate.summary.slice(0, 600),
          isDefault: true,
        },
      ]
    : [];

  return {
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
}

export async function parseUploadedPdfToProfile(
  resumeId: string,
  userId: string,
  opts: { quota?: { userId: string; route: string } } = {},
): Promise<ParseResult> {
  // Default quota scope to the parse-pdf route so token spend is debited
  // even when the caller forgets to pass quota explicitly.
  const quota = opts.quota ?? {
    userId,
    route: "/api/resumes/profile/parse-pdf",
  };
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId, isDeleted: false },
  });
  if (!resume) {
    throw new Error("Resume not found");
  }
  if (!resume.content || resume.content.length < 100) {
    throw new Error("Resume has no extractable text. Try re-parsing the PDF first.");
  }

  const warnings: unknown[] = [];

  // ── 1. Cache hit ──────────────────────────────────────────────────
  // If the row has a previously-saved parsedProfile that's still fresh,
  // re-validate it (schema may have evolved since the cache was written)
  // and short-circuit.
  if (
    resume.parsedProfile &&
    resume.parsedProfileAt &&
    Date.now() - resume.parsedProfileAt.getTime() < CACHE_TTL_MS
  ) {
    const cached = resume.parsedProfile;
    const cachedValidation = ResumeProfileSchema.safeParse(cached);
    if (cachedValidation.success) {
      return {
        profile: cachedValidation.data,
        raw: cached,
        warnings: [],
        strategy: "cache",
        resumeId: resume.id,
        resumeName: resume.name,
      };
    }
    // Cache is stale-by-shape (schema change). Fall through to re-parse.
    warnings.push("Cached profile failed re-validation; re-parsing.");
  }

  // ── 2. Strategy chain: Groq → Gemini → heuristic ──────────────────
  let candidate: ParsedCandidate | null = null;
  let strategy: ParseStrategy | null = null;

  // 2a. Groq
  try {
    candidate = await runLlmExtraction(
      (s, u) =>
        generateWithGroq(s, u, {
          temperature: 0.1,
          max_tokens: 2000,
          quota,
        }),
      resume.content,
    );
    strategy = "groq";
  } catch (err) {
    warnings.push(
      `Groq parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 2b. Gemini
  if (!candidate) {
    try {
      candidate = await runLlmExtraction(
        (s, u) => generateWithGeminiDirect(s, u),
        resume.content,
      );
      strategy = "gemini";
    } catch (err) {
      warnings.push(
        `Gemini parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 2c. Regex heuristic — always succeeds (may return mostly-empty fields)
  if (!candidate) {
    candidate = heuristicToCandidate(parseProfileHeuristic(resume.content));
    strategy = "heuristic";
    warnings.push(
      "Used heuristic parser — some fields may be empty. Verify your profile.",
    );
  }

  const shaped = shapeCandidate(candidate);
  const validation = ResumeProfileSchema.safeParse(shaped);

  // ── 3. Persist cache (LLM strategies only — heuristic is not cached) ──
  if (validation.success && (strategy === "groq" || strategy === "gemini")) {
    try {
      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsedProfile: validation.data as unknown as object,
          parsedProfileAt: new Date(),
        },
      });
    } catch (err) {
      // Cache-write failure must not break the parse path.
      warnings.push(
        `Cache write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    profile: validation.success ? validation.data : null,
    raw: shaped,
    warnings: validation.success
      ? warnings
      : [...warnings, ...validation.error.issues.slice(0, 10)],
    strategy: strategy ?? "heuristic",
    resumeId: resume.id,
    resumeName: resume.name,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Heuristic parser — last-resort regex extraction
// ─────────────────────────────────────────────────────────────────────

/**
 * Flattened lower-cased variants from synonyms.json mapped to their canonical
 * form, computed once at module load. Used by `parseProfileHeuristic` to detect
 * known skills in raw PDF text without an LLM.
 */
const SKILL_VARIANT_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  const entries = synonyms as Record<
    string,
    { canonical: string; variants: string[] }
  >;
  for (const key of Object.keys(entries)) {
    const { canonical, variants } = entries[key];
    for (const v of variants ?? []) {
      const norm = v.trim().toLowerCase();
      if (norm.length >= 2) m.set(norm, canonical);
    }
    // Also map the canonical itself so single-word forms hit.
    m.set(canonical.trim().toLowerCase(), canonical);
  }
  return m;
})();

// Simple RFC 5322-ish email — intentionally loose; the LLM-validated path
// gets stricter checks via Zod downstream.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// International (+CC) or local — 7-15 digits with common separators.
const PHONE_RE = /(\+\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;
// 4-digit years 2000-2099 used for experience-span detection.
const YEAR_RE = /20\d{2}/g;
// Common degree markers — covers Bachelor's/Master's/PhD variants.
const DEGREE_RE =
  /\b(B\.?\s?(?:S|A|E|Tech|Sc|Eng)\.?|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z]+)?|M\.?\s?(?:S|A|Tech|Sc|Eng|B\.?A)\.?|Master(?:'s)?(?:\s+of\s+[A-Za-z]+)?|Ph\.?\s?D\.?|Doctor(?:ate)?(?:\s+of\s+[A-Za-z]+)?)\b/i;
// "University of X", "X University", "X Institute of Technology", "X College".
const UNIVERSITY_RE =
  /\b(?:(?:[A-Z][A-Za-z.&'-]+\s+){0,4}(?:University|Institute(?:\s+of\s+[A-Z][A-Za-z]+)?|College|Polytechnic|School(?:\s+of\s+[A-Z][A-Za-z]+)?)|University\s+of\s+(?:[A-Z][A-Za-z.&'-]+\s*){1,4})/;

/**
 * Best-effort partial profile derived from raw PDF text using only regex +
 * the synonym dictionary. Every field is optional — fields that didn't match
 * cleanly are simply omitted so the caller (and the user) can spot the gaps.
 *
 * Exported for unit testing and to let callers run the heuristic stand-alone
 * (e.g. to pre-populate a "looks like:" preview before kicking off the LLM).
 */
export function parseProfileHeuristic(pdfText: string): Partial<ResumeProfile> {
  const text = pdfText.replace(/\r/g, "").trim();
  if (!text) return {};

  // ── Name: scan the top ~10 non-empty lines, pick the most "name-like" one.
  // Heuristic: 2-5 words, mostly capitalized, no digits/@, length 5-60.
  const topLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
  let fullName = "";
  for (const line of topLines) {
    if (line.length < 5 || line.length > 60) continue;
    if (/[@\d]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    const titleCased = words.filter((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w)).length;
    if (titleCased >= Math.max(2, words.length - 1)) {
      fullName = line;
      break;
    }
  }
  // Fallback: just take the very first non-empty line.
  if (!fullName && topLines[0]) fullName = topLines[0].slice(0, 60);

  // ── Email
  const email = text.match(EMAIL_RE)?.[0] ?? "";

  // ── Phone (skip matches that look like years/zip codes)
  let phone = "";
  const phoneRegex = new RegExp(PHONE_RE.source, "g");
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
    const digits = (phoneMatch[0].match(/\d/g) ?? []).length;
    if (digits >= 7 && digits <= 15) {
      phone = phoneMatch[0].trim();
      break;
    }
    // Guard against zero-length matches (PHONE_RE has all-optional groups).
    if (phoneMatch.index === phoneRegex.lastIndex) phoneRegex.lastIndex++;
  }

  // ── Skills: scan the whole text in lowercase for known variants.
  const lower = text.toLowerCase();
  const foundSkills = new Set<string>();
  SKILL_VARIANT_TO_CANONICAL.forEach((canonical, variant) => {
    if (foundSkills.size >= 80) return;
    // Word-boundary check — avoid "go" matching "going", "r" matching "are".
    const re = new RegExp(
      `(^|[^a-z0-9+#.-])${escapeRegex(variant)}([^a-z0-9+#.-]|$)`,
      "i",
    );
    if (re.test(lower)) foundSkills.add(canonical);
  });

  // ── Years of work: pair up 20XX dates and sum the spans.
  // Looks for "20XX – 20XX" / "20XX - Present" patterns.
  let totalYears = 0;
  const now = new Date().getFullYear();
  const rangeRe = /(20\d{2})\s*[-–—to]+\s*(20\d{2}|present|current|now)/gi;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRe.exec(text)) !== null) {
    const start = parseInt(rangeMatch[1], 10);
    const end = /^(20\d{2})$/i.test(rangeMatch[2])
      ? parseInt(rangeMatch[2], 10)
      : now;
    if (end >= start && end - start <= 50) totalYears += end - start;
  }
  // Fallback: min/max years anywhere in text (very crude).
  if (totalYears === 0) {
    const allYears = (text.match(YEAR_RE) ?? []).map((y) => parseInt(y, 10));
    if (allYears.length >= 2) {
      const span = Math.max.apply(null, allYears) - Math.min.apply(null, allYears);
      if (span > 0 && span <= 50) totalYears = span;
    }
  }

  // ── Education: find a degree marker + nearby university name.
  const education: ResumeProfile["education"] = [];
  const degreeMatch = text.match(DEGREE_RE);
  if (degreeMatch) {
    // Search a ±200-char window around the degree for a university token.
    const idx = degreeMatch.index ?? 0;
    const windowStart = Math.max(0, idx - 200);
    const windowEnd = Math.min(text.length, idx + 200);
    const around = text.slice(windowStart, windowEnd);
    const uniMatch = around.match(UNIVERSITY_RE);
    education.push({
      institution: (uniMatch?.[0] ?? "").trim().slice(0, 120),
      degree: degreeMatch[0].trim().slice(0, 80),
      order: 0,
    });
  }

  // ── Build the partial profile. `headline` defaults to a derived role
  // when we have years of experience, otherwise stays empty.
  const headline = totalYears > 0 ? `${totalYears}+ years experience` : "";

  return {
    header: {
      fullName,
      headline,
      email,
      phone: phone || undefined,
    },
    skills: Array.from(foundSkills),
    education,
  };
}

/**
 * Adapts the heuristic's `Partial<ResumeProfile>` into the looser `ParsedCandidate`
 * shape used by `shapeCandidate`. Fields the heuristic couldn't extract become
 * empty strings/arrays so downstream length caps and Zod parsing still apply
 * uniformly.
 */
function heuristicToCandidate(p: Partial<ResumeProfile>): ParsedCandidate {
  return {
    header: {
      fullName: p.header?.fullName ?? "",
      headline: p.header?.headline ?? "",
      location: p.header?.location,
      email: p.header?.email ?? "",
      phone: p.header?.phone,
      websiteUrl: p.header?.websiteUrl,
      githubUrl: p.header?.githubUrl,
      linkedinUrl: p.header?.linkedinUrl,
    },
    summary: undefined,
    skills: p.skills ?? [],
    experiences: [],
    projects: [],
    education: (p.education ?? []).map((e) => ({
      institution: e.institution,
      degree: e.degree,
      startDate: e.startDate,
      endDate: e.endDate,
      details: e.details,
    })),
    certifications: [],
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
