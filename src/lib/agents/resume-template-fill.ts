/**
 * Agent 5: Resume Template Fill (optional, NOT in the auto-apply chain)
 *
 * Chains AFTER `tailorResume` (Agent 2). Consumes:
 *   - tailorResume's output: { relevantSkills, bulletSuggestions, missingKeywords }
 *   - The user's full structured profile (sections + skills)
 *   - The chosen template's id (T01..T05 in v1)
 *
 * Produces:
 *   - skillsOrder    — JD-prioritized permutation/subset of profile.skills
 *   - projectIds     — ordered subset of profile.projects (top-K)
 *   - summaryId      — best-fit user summary (or null)
 *   - sectionOrder   — section order, possibly projects-first
 *
 * The agent only RANKS items the user has entered. The hard rule survives:
 *   - Never adds skills the user doesn't have
 *   - Never rewrites bullets/companies/dates
 *   - Surfaces JD-required skills the user is missing as a separate field
 *     so the caller can warn rather than silently dropping them
 *
 * Uses generateWithGroq (with Gemini fallback inlined) — same client as
 * the other agents, no parallel pipeline.
 */

import { z } from "zod";
import { generateWithGroq } from "@/lib/groq";
import type { TailoredResume } from "./resume-tailor";
import type { ResumeProfile, SectionKey } from "@/lib/resume/types";

const RankSchema = z.object({
  skillsOrder: z.array(z.string()).max(80),
  projectIds: z.array(z.string()).max(10),
  summaryId: z.string().nullable(),
  layoutBias: z.enum(["projects-first", "experience-first", "balanced"]),
});
type Ranked = z.infer<typeof RankSchema>;

export interface TemplateFillResult {
  skillsOrder: string[];
  projectIds: string[];
  summaryId: string | null;
  sectionOrder: SectionKey[];
  /** Hard requirements named by the JD that the user doesn't have on their profile. */
  missingHardSkills: string[];
  /** Echoed for the diff sidebar. */
  matchedKeywords: string[];
}

export interface TemplateFillInput {
  profile: ResumeProfile;
  tailored: TailoredResume;
  templateId: string;
  /** Page target — caps project count: 3 for 1pg, 5 for 2pg. */
  pageTarget?: 1 | 2;
  /** Optional JD text — used for soft scoring of layoutBias when present. */
  jdText?: string;
}

const SYSTEM_PROMPT = `You arrange resume content for a job. You DO NOT rewrite anything.

Given a candidate's profile + their JD-relevant signal, return STRICT JSON:
{
  "skillsOrder":  string[],  // user's skill names, JD-prioritized; subset of their list, no new ones
  "projectIds":   string[],  // ordered project ids, top-K only
  "summaryId":    string | null,  // pick the best-matching user summary by id
  "layoutBias":   "projects-first" | "experience-first" | "balanced"
}

Rules:
- skillsOrder MUST be a subset of the input "candidateSkills". No fabrication.
- projectIds MUST be a subset of the input "candidateProjects" ids.
- summaryId MUST match one of the input "candidateSummaries" ids, or be null.
- Use relevantSkills (from upstream agent) to anchor skill ordering.
- Sort projects by stack overlap with required+nice keywords; featured = soft boost.
- Return ONLY the JSON. No prose, no markdown fence.`;

function buildUserPrompt(input: TemplateFillInput): string {
  const { profile, tailored, jdText } = input;
  return [
    `Template: ${input.templateId}`,
    `Page target: ${input.pageTarget ?? 1}`,
    "",
    `Upstream tailorResume signal:`,
    `  relevantSkills: ${tailored.relevantSkills.join(", ") || "(none)"}`,
    `  missingKeywords: ${tailored.missingKeywords.join(", ") || "(none)"}`,
    "",
    `candidateSkills: ${profile.skills.join(", ") || "(empty)"}`,
    "",
    `candidateSummaries:`,
    ...profile.summaries.map((s) => `  - id=${s.id ?? "<new>"} label="${s.label}" default=${s.isDefault}`),
    "",
    `candidateProjects (id · title · stack · featured):`,
    ...profile.projects.map(
      (p) =>
        `  - id=${p.id ?? "<new>"} · ${p.title} · ${p.stack.join("|")} · ${p.isFeatured ? "featured" : ""}`,
    ),
    "",
    jdText ? `JD snippet (first 1500 chars):\n${jdText.slice(0, 1500)}` : "",
  ].join("\n");
}

function parseModelJson(raw: string): Ranked {
  const text = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? raw;
  const obj = JSON.parse(text.trim());
  return RankSchema.parse(obj);
}

const norm = (s: string) => s.toLowerCase().trim();

function safeProjectIds(modelIds: string[], profile: ResumeProfile, k: number): string[] {
  const valid = new Set(profile.projects.map((p) => p.id!).filter(Boolean));
  const ordered = modelIds.filter((id) => valid.has(id));
  if (ordered.length >= k) return ordered.slice(0, k);

  // Pad with remaining featured-then-rest in original order
  const remaining = profile.projects
    .filter((p) => p.id && !ordered.includes(p.id))
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  for (const p of remaining) {
    if (ordered.length >= k) break;
    ordered.push(p.id!);
  }
  return ordered;
}

function safeSkillsOrder(modelOrder: string[], profile: ResumeProfile): string[] {
  const inProfile = new Set(profile.skills);
  const filtered = modelOrder.filter((s) => inProfile.has(s));
  const rest = profile.skills.filter((s) => !filtered.includes(s));
  return [...filtered, ...rest];
}

function chooseSectionOrder(bias: Ranked["layoutBias"]): SectionKey[] {
  if (bias === "projects-first") {
    return ["summary", "skills", "projects", "experience", "education"];
  }
  return ["summary", "skills", "experience", "projects", "education"];
}

function computeMissingHardSkills(
  tailored: TailoredResume,
  profile: ResumeProfile,
): string[] {
  const have = new Set(profile.skills.map(norm));
  return tailored.missingKeywords.filter((k) => !have.has(norm(k)));
}

/**
 * Run the agent. Falls back to a deterministic default ordering if the model
 * fails, so the caller can always render — it just won't be JD-tailored.
 */
export async function fillTemplate(input: TemplateFillInput): Promise<TemplateFillResult> {
  const { profile, tailored } = input;
  const maxProjects = input.pageTarget === 2 ? 5 : 3;
  const missingHardSkills = computeMissingHardSkills(tailored, profile);

  let model: Ranked;
  try {
    const raw = await generateWithGroq(SYSTEM_PROMPT, buildUserPrompt(input), {
      temperature: 0.1,
      max_tokens: 1200,
    });
    model = parseModelJson(raw);
  } catch (err) {
    // Deterministic fallback — no LLM needed, no fabrication
    console.warn(
      `[resume-template-fill] LLM failed, using fallback ordering:`,
      err instanceof Error ? err.message : err,
    );
    const relevantSet = new Set(tailored.relevantSkills.map(norm));
    const fallbackOrder = [
      ...profile.skills.filter((s) => relevantSet.has(norm(s))),
      ...profile.skills.filter((s) => !relevantSet.has(norm(s))),
    ];
    const fallbackProjects = profile.projects
      .map((p) => ({ id: p.id!, score: p.isFeatured ? 1 : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxProjects)
      .map((p) => p.id);
    const def =
      profile.summaries.find((s) => s.isDefault) ?? profile.summaries[0];
    return {
      skillsOrder: fallbackOrder,
      projectIds: fallbackProjects,
      summaryId: def?.id ?? null,
      sectionOrder: chooseSectionOrder("balanced"),
      missingHardSkills,
      matchedKeywords: tailored.relevantSkills,
    };
  }

  return {
    skillsOrder: safeSkillsOrder(model.skillsOrder, profile),
    projectIds: safeProjectIds(model.projectIds, profile, maxProjects),
    summaryId: model.summaryId,
    sectionOrder: chooseSectionOrder(model.layoutBias),
    missingHardSkills,
    matchedKeywords: tailored.relevantSkills,
  };
}
