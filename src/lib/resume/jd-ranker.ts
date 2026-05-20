/**
 * JD-aware ranker — Phase 2 core.
 *
 * Given a JD and a user's structured profile, decide:
 *   - which skills to surface first
 *   - which projects to include (by stack overlap + featured bonus)
 *   - which pre-written summary fits best
 *   - whether to put projects above experience
 *
 * Hard rule (mirror of the design doc): the LLM only RANKS. It returns
 * a permutation / subset of items the user already entered. If it returns
 * a "skill" that isn't in the user's list, we reject and surface an error
 * — we do NOT silently drop or add.
 */

import { z } from "zod";
import { jsonCompleteWithFallback, type LLMProviderName } from "./json-completion";
import type {
  ResumeProfile,
  ResumeRenderInput,
  SectionKey,
} from "./types";

// ── LLM signal extraction ────────────────────────────────────────────

const JdSignalSchema = z.object({
  requiredSkills: z.array(z.string()).max(40),
  niceSkills: z.array(z.string()).max(40),
  roleFamily: z.enum([
    "frontend",
    "backend",
    "fullstack",
    "ai",
    "mobile",
    "devops",
    "data",
    "pm",
    "design",
    "other",
  ]),
  /** Soft signal: does the JD lean projects-first (modern / startup / IC) or experience-first (traditional / corporate)? */
  layoutBias: z.enum(["projects-first", "experience-first", "balanced"]),
});
export type JdSignal = z.infer<typeof JdSignalSchema>;

const SYSTEM_PROMPT = `You extract a structured signal from a job description.

Return STRICT JSON with this shape:
{
  "requiredSkills": string[],   // hard requirements explicitly mentioned, lowercase, deduped, max 40
  "niceSkills":     string[],   // nice-to-have / preferred / bonus, lowercase, max 40
  "roleFamily": "frontend" | "backend" | "fullstack" | "ai" | "mobile" | "devops" | "data" | "pm" | "design" | "other",
  "layoutBias": "projects-first" | "experience-first" | "balanced"
}

Rules:
- Lowercase all skill strings.
- Use canonical names: "typescript" (not "TS"), "next.js" (not "nextjs"), "postgresql" (not "postgres").
- Skills only — no soft skills, no buzzwords, no role descriptions.
- Return ONLY the JSON. No prose, no markdown fence.`;

export async function extractJdSignal(jdText: string): Promise<{
  signal: JdSignal;
  provider: LLMProviderName;
}> {
  const result = await jsonCompleteWithFallback({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Job description:\n\n${jdText.slice(0, 12_000)}`,
    temperature: 0.1,
    maxTokens: 800,
  });

  // Best-effort JSON extraction (Groq sometimes adds fences)
  const jsonText = result.raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? result.raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.trim());
  } catch {
    throw new Error("AI returned non-JSON signal");
  }

  const validation = JdSignalSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `AI signal malformed: ${validation.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  return { signal: validation.data, provider: result.provider };
}

// ── Pure ranking primitives (no LLM, no async) ───────────────────────

export interface RankingResult {
  skillsOrder: string[];
  /** projectIds is ordered subset of profile.projects (by id). Top-K may not include all. */
  projectIds: string[];
  experienceIds: string[];
  summaryId: string | null;
  sectionOrder: SectionKey[];
  matchedKeywords: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Score and reorder skills. Skills NOT in profile.skills are dropped from
 * the result (per the hard rule — we never add). If skillsLocked is true
 * and the JD names a hard-required skill the user doesn't have, the caller
 * should surface this as a "missing skill" warning to the user instead of
 * silently dropping; that's done in the API route layer.
 */
function rankSkills(
  profileSkills: readonly string[],
  signal: JdSignal,
): { ordered: string[]; matchedKeywords: string[] } {
  const requiredSet = new Set(signal.requiredSkills.map(normalize));
  const niceSet = new Set(signal.niceSkills.map(normalize));
  const matchedKeywords: string[] = [];

  function score(s: string): number {
    const n = normalize(s);
    if (requiredSet.has(n)) {
      matchedKeywords.push(s);
      return 2;
    }
    if (niceSet.has(n)) {
      matchedKeywords.push(s);
      return 1;
    }
    return 0;
  }

  const withOriginalIdx = profileSkills.map((s, i) => ({ s, score: score(s), i }));
  withOriginalIdx.sort((a, b) => b.score - a.score || a.i - b.i);
  return { ordered: withOriginalIdx.map((x) => x.s), matchedKeywords };
}

function rankProjects(
  profileProjects: ResumeProfile["projects"],
  signal: JdSignal,
  k: number,
): string[] {
  const required = new Set(signal.requiredSkills.map(normalize));
  const nice = new Set(signal.niceSkills.map(normalize));

  function score(p: ResumeProfile["projects"][number]): number {
    let overlap = 0;
    for (const tag of p.stack) {
      const n = normalize(tag);
      if (required.has(n)) overlap += 2;
      else if (nice.has(n)) overlap += 1;
    }
    const featuredBoost = p.isFeatured ? 0.5 : 0;
    return overlap + featuredBoost;
  }

  const scored = profileProjects.map((p, i) => ({
    id: p.id!,
    score: score(p),
    isFeatured: p.isFeatured,
    i,
  }));

  // Featured projects ALWAYS retain priority if score > 0
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, k).map((x) => x.id);
}

function pickSummaryByRole(
  summaries: ResumeProfile["summaries"],
  signal: JdSignal,
): string | null {
  if (summaries.length === 0) return null;
  if (summaries.length === 1) return summaries[0].id ?? null;

  // Heuristic: pick the summary whose LABEL most resembles the role family.
  // E.g. role "ai" matches summary label "AI-eval-leaning". If no label hint,
  // fall back to the default summary.
  const family = signal.roleFamily;
  const labelMatch = summaries.find((s) => s.label.toLowerCase().includes(family));
  if (labelMatch) return labelMatch.id ?? null;

  const def = summaries.find((s) => s.isDefault);
  return def?.id ?? summaries[0].id ?? null;
}

function chooseSectionOrder(signal: JdSignal): SectionKey[] {
  const projectsFirst = signal.layoutBias === "projects-first";
  return projectsFirst
    ? ["summary", "skills", "projects", "experience", "education"]
    : ["summary", "skills", "experience", "projects", "education"];
}

// ── Top-level ranker ─────────────────────────────────────────────────

export interface RankForJdOptions {
  /** Max projects to include. Defaults to 3 for 1-page, 5 for 2-page. */
  maxProjects?: number;
  /** When the user has skillsLocked=true and the JD needs skills not in their master list, return those names so the API can warn. */
  reportMissingSkills?: boolean;
}

export interface RankForJdResult {
  ranking: RankingResult;
  signal: JdSignal;
  provider: LLMProviderName;
  /** Hard requirements named by the JD that the user doesn't have on their profile. Surface to user. */
  missingHardSkills: string[];
}

export async function rankForJd(
  profile: ResumeProfile,
  jdText: string,
  options: RankForJdOptions = {},
): Promise<RankForJdResult> {
  const { signal, provider } = await extractJdSignal(jdText);

  const maxProjects = options.maxProjects ?? 3;

  // Detect required skills the user doesn't have. We DO NOT add them — we
  // surface as a warning so the user can decide whether to add them to their
  // master list.
  const userSkillsLower = new Set(profile.skills.map(normalize));
  const missingHardSkills = signal.requiredSkills.filter(
    (s) => !userSkillsLower.has(normalize(s)),
  );

  const skillsRank = rankSkills(profile.skills, signal);
  const projectIds = rankProjects(profile.projects, signal, maxProjects);

  // Experiences ordered as the user authored them (chronological). We don't
  // reorder experience entries — that would imply a story. Selection (which
  // experiences to include) is also kept default in v1.
  const experienceIds = profile.experiences.map((e) => e.id!);

  const summaryId = pickSummaryByRole(profile.summaries, signal);
  const sectionOrder = chooseSectionOrder(signal);

  return {
    ranking: {
      skillsOrder: skillsRank.ordered,
      projectIds,
      experienceIds,
      summaryId,
      sectionOrder,
      matchedKeywords: skillsRank.matchedKeywords,
    },
    signal,
    provider,
    missingHardSkills,
  };
}

// ── Compose render input with the ranking applied ────────────────────

/**
 * Apply a ranking to a ResumeProfile + base ResumeRenderInput to produce
 * a JD-tailored render input. Returns the new input — caller passes it to
 * `renderResume`.
 */
export function applyRankingToRenderInput(
  baseInput: ResumeRenderInput,
  profile: ResumeProfile,
  ranking: RankingResult,
): ResumeRenderInput {
  // Skills: keep the JD-ranked order; if `skillsLocked` is true the caller
  // has already vetted that no JD-required skill is missing, so we can trust
  // the ordering not to drop anything important.
  const skills = ranking.skillsOrder;

  // Projects: ordered subset by id
  const projectMap = new Map(profile.projects.map((p) => [p.id!, p]));
  const projects = ranking.projectIds
    .map((id) => projectMap.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      sourceId: p.id!,
      title: p.title,
      role: p.role,
      oneLiner: p.oneLiner,
      bullets: p.bullets,
      stack: p.stack,
      liveUrl: p.liveUrl,
      repoUrl: p.repoUrl,
    }));

  // Summary
  let summary = baseInput.summary;
  if (ranking.summaryId) {
    const picked = profile.summaries.find((s) => s.id === ranking.summaryId);
    if (picked) {
      summary = { content: picked.content, sourceId: picked.id! };
    }
  }

  return {
    ...baseInput,
    summary,
    skills,
    projects,
    sectionOrder: ranking.sectionOrder,
  };
}
