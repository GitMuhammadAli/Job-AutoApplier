/**
 * Agent 4: Resume Rewriter
 *
 * Position in the pipeline:
 *   1. Researcher       — pulls JD signal
 *   2. Tailor           — picks which existing skills/bullets are JD-relevant
 *   3. (Template fill)  — assembles the render input
 *   4. **Rewriter**     — this file. Rephrases bullets/summary/skill labels in
 *                          the JD's voice WITHOUT introducing new facts.
 *
 * Hard contract:
 *   - We NEVER add a technology, metric, company, or scope claim that wasn't in
 *     the source bullet / summary / profile.
 *   - We ONLY change verbs, adjectives, and sentence structure.
 *   - Every rewrite is gated by `runAuditLayers` (layers 1 + 2 per-bullet; full
 *     pass for the final whole-resume audit).
 *   - On audit failure we retry up to 2x with explicit feedback about what was
 *     fabricated; if still failing, we return the original verbatim and emit a
 *     warning. We never ship a fabricated rewrite.
 *
 * Skill-label rewriter is intentionally minimal — it only proposes a relabel
 * when the profile skill AND the JD term map to the same canonical via the
 * synonym registry. That's the only safe path to "Postgres" → "PostgreSQL".
 *
 * No I/O beyond Groq calls. Stateless. Pass `quota` to enforce per-user token
 * budgets — propagated to `generateWithGroq`.
 */

import fs from "node:fs";
import path from "node:path";

import { generateWithGroq } from "@/lib/groq";
import {
  runAuditLayers,
  type AuditResult,
} from "@/lib/resume/audit-layers";
import type {
  ResumeExperience,
  ResumeProfile,
  ResumeProject,
} from "@/lib/resume/types";
import type { TailoredResume } from "@/lib/agents/resume-tailor";

// ── Public types ─────────────────────────────────────────────────────

export type QuotaScope = { userId: string; route: string };

export interface RewriteInput {
  profile: ResumeProfile;
  tailored: TailoredResume;
  jdText: string;
  quota?: QuotaScope;
}

export interface RewriteResult {
  /** Rewritten summary text, or null if no summary was selected / rewrite failed. */
  rewrittenSummary: string | null;
  /** Map of bullet → rewritten bullet. Key is the ORIGINAL bullet string. */
  rewrittenBullets: Map<string, string>;
  /** Map of profile skill → JD-aligned label. Key is the profile's verbatim skill. */
  rewrittenSkillLabels: Map<string, string>;
  /** Final whole-resume audit result against the composed rewritten text. */
  auditResult: AuditResult;
  /** Human-readable issues that didn't block the rewrite (e.g. retries failed). */
  warnings: string[];
}

// ── Synonym registry loader (mirrors audit-layers.ts probe order) ─────

interface SynonymEntry {
  canonical?: string;
  variants?: string[];
  category?: string;
}
type SynonymRegistry = Record<string, SynonymEntry>;

function safeLoadJson<T>(relPath: string): T | null {
  const candidates = [
    path.resolve(process.cwd(), "src/lib/resume", relPath),
    path.resolve(process.cwd(), "src/data/resume", relPath),
    path.resolve(process.cwd(), "data/resume", relPath),
    path.resolve(__dirname, "..", "resume", relPath),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8")) as T;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

const SYNONYMS: SynonymRegistry =
  safeLoadJson<SynonymRegistry>("synonyms.json") ?? {};

/**
 * Precomputed (lowercased variant → canonical-key). The canonical-key is the
 * top-level JSON key (e.g. "postgresql"), NOT the display string — that's what
 * we use to test "do two terms map to the same skill?".
 */
const VARIANT_TO_CANONICAL_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, entry] of Object.entries(SYNONYMS)) {
    const k = key.toLowerCase();
    m.set(k, k);
    if (entry?.canonical && typeof entry.canonical === "string") {
      m.set(entry.canonical.toLowerCase().trim(), k);
    }
    if (Array.isArray(entry?.variants)) {
      for (const v of entry.variants) {
        if (typeof v === "string" && v.trim()) {
          m.set(v.toLowerCase().trim(), k);
        }
      }
    }
  }
  return m;
})();

/** Display string for a canonical key (entry.canonical preferred over the key). */
function displayForCanonical(key: string): string {
  const entry = SYNONYMS[key];
  if (entry?.canonical && typeof entry.canonical === "string") return entry.canonical;
  // Fallback: title-case the key.
  return key
    .split(/[-_\s]+/)
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(" ");
}

function canonicalKeyFor(term: string): string | null {
  return VARIANT_TO_CANONICAL_KEY.get(term.toLowerCase().trim()) ?? null;
}

// ── JSON parse helper (Groq tends to wrap in ```json fences) ──────────

function parseJsonLoose<T = unknown>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    // Last-ditch: pull the first {...} block.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── A. Bullet rewriter ───────────────────────────────────────────────

const BULLET_SYSTEM_PROMPT = `You rewrite resume bullets to use the JD vocabulary while keeping every fact identical. NEVER add a technology, metric, company, or scope claim not in the original bullet. ONLY change verbs, adjectives, and sentence structure. Output JSON: {"rewritten": "..."}`;

const BULLET_FEW_SHOTS = `Examples:

GOOD rewrite (verbs/structure changed; no new facts):
  Original: "Worked on building a React dashboard for the analytics team"
  JD keywords: ["frontend", "data visualization"]
  Rewritten: "Engineered a React-based analytics dashboard for the data visualization team"

BAD rewrite (added "10,000 users" — not in original):
  Original: "Worked on building a React dashboard for the analytics team"
  JD keywords: ["scale", "users"]
  Rewritten: "Built a React dashboard serving 10,000+ users for the analytics team"

BAD rewrite (added "GraphQL" — not in original or profile):
  Original: "Built REST endpoints for the payments service"
  JD keywords: ["GraphQL", "APIs"]
  Rewritten: "Built REST and GraphQL endpoints for the payments service"`;

function buildBulletUserPrompt(
  originalBullet: string,
  relevantJdKeywords: string[],
  feedback?: string,
): string {
  return [
    `Original bullet:\n${originalBullet}`,
    `Relevant JD keywords (use only the ones the bullet already supports):\n${
      relevantJdKeywords.slice(0, 12).join(", ") || "(none)"
    }`,
    BULLET_FEW_SHOTS,
    feedback
      ? `IMPORTANT: Previous attempt was rejected. ${feedback}`
      : "",
    'Output JSON only: {"rewritten": "..."}',
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Run audit layers 1 + 2 on a single bullet (with the profile as truth-source). */
function auditBulletOnly(
  rewritten: string,
  profile: ResumeProfile,
): { passed: boolean; reasons: string[] } {
  const r = runAuditLayers({ renderedText: rewritten, profile });
  const reasons: string[] = [];
  for (const t of r.hardFabrications) {
    reasons.push(`introduced "${t}" which is not in the profile`);
  }
  for (const n of r.numberFabrications) {
    reasons.push(`introduced number "${n}" which is not in the original`);
  }
  // We deliberately ignore layer 3 (date triplets) and layer 4 (soft warnings)
  // at the bullet level — a bullet usually has neither, and we'd false-positive.
  return {
    passed: reasons.length === 0,
    reasons,
  };
}

async function rewriteOneBullet(
  originalBullet: string,
  relevantJdKeywords: string[],
  profile: ResumeProfile,
  quota: QuotaScope | undefined,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const MAX_RETRIES = 2;
  let feedback: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let raw: string;
    try {
      raw = await generateWithGroq(
        BULLET_SYSTEM_PROMPT,
        buildBulletUserPrompt(originalBullet, relevantJdKeywords, feedback),
        {
          temperature: 0.3,
          max_tokens: 280,
          model: "llama-3.3-70b-versatile",
          quota,
        },
      );
    } catch (err) {
      return {
        ok: false,
        reason: `LLM error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const parsed = parseJsonLoose<{ rewritten?: unknown }>(raw);
    const rewritten =
      parsed && typeof parsed.rewritten === "string" ? parsed.rewritten.trim() : "";
    if (!rewritten) {
      feedback =
        "Your previous response was not valid JSON with a 'rewritten' string. Output JSON only.";
      continue;
    }

    const audit = auditBulletOnly(rewritten, profile);
    if (audit.passed) {
      return { ok: true, text: rewritten };
    }

    if (attempt < MAX_RETRIES) {
      feedback = `You fabricated: ${audit.reasons.join("; ")}. Do not include any of those. Rewrite using ONLY facts from the original bullet.`;
      continue;
    }
    return {
      ok: false,
      reason: `audit failed after ${MAX_RETRIES + 1} attempts: ${audit.reasons.join("; ")}`,
    };
  }

  return { ok: false, reason: "exhausted retries with no parseable output" };
}

/**
 * Decide which bullets to attempt rewrites on. The tailored result doesn't
 * explicitly select bullets — it selects relevant skills. We conservatively
 * rewrite every bullet in every experience + project. Callers that want to
 * narrow this down can post-filter the returned map.
 */
function collectBullets(profile: ResumeProfile): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const exp of profile.experiences as ResumeExperience[]) {
    for (const b of exp.bullets) push(b);
  }
  for (const proj of profile.projects as ResumeProject[]) {
    for (const b of proj.bullets) push(b);
  }
  return out;
}

// ── B. Summary rewriter ──────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You rewrite a resume summary to speak in the JD's voice while keeping every fact identical. NEVER add a technology, metric, company, role, or scope claim not in the original summary. ONLY change verbs, adjectives, and sentence structure. Output JSON: {"rewritten": "..."}`;

const SUMMARY_FEW_SHOTS = `Examples:

GOOD rewrite (tone shifted toward JD; no new claims):
  Original: "Backend engineer with 5 years building APIs and data pipelines in Python"
  JD keywords: ["distributed systems", "Python"]
  Rewritten: "Backend engineer with 5 years architecting Python APIs and data pipelines"

BAD rewrite (added "Kubernetes" — not in original):
  Original: "Backend engineer with 5 years building APIs and data pipelines in Python"
  JD keywords: ["Kubernetes", "Python"]
  Rewritten: "Backend engineer with 5 years building Python APIs on Kubernetes"`;

function pickClosestSummary(
  profile: ResumeProfile,
  jdLower: string,
): { id: string | null; content: string } | null {
  if (!profile.summaries || profile.summaries.length === 0) return null;
  // Score each summary by JD-keyword overlap; tiebreak with isDefault.
  let best = profile.summaries[0];
  let bestScore = -1;
  for (const s of profile.summaries) {
    const tokens = s.content.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
    let overlap = 0;
    for (const t of tokens) {
      if (t.length > 3 && jdLower.includes(t)) overlap++;
    }
    if (s.isDefault) overlap += 0.5;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = s;
    }
  }
  return { id: best.id ?? null, content: best.content };
}

async function rewriteSummary(
  profile: ResumeProfile,
  tailored: TailoredResume,
  jdText: string,
  quota: QuotaScope | undefined,
): Promise<{ ok: true; text: string } | { ok: false; reason: string } | { ok: "skip" }> {
  const picked = pickClosestSummary(profile, jdText.toLowerCase());
  if (!picked) return { ok: "skip" };

  const MAX_RETRIES = 2;
  let feedback: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userPrompt = [
      `Original summary:\n${picked.content}`,
      `Relevant JD keywords (use only the ones the summary already supports):\n${
        tailored.relevantSkills.slice(0, 12).join(", ") || "(none)"
      }`,
      SUMMARY_FEW_SHOTS,
      feedback ? `IMPORTANT: Previous attempt was rejected. ${feedback}` : "",
      'Output JSON only: {"rewritten": "..."}',
    ]
      .filter(Boolean)
      .join("\n\n");

    let raw: string;
    try {
      raw = await generateWithGroq(SUMMARY_SYSTEM_PROMPT, userPrompt, {
        temperature: 0.3,
        max_tokens: 400,
        model: "llama-3.3-70b-versatile",
        quota,
      });
    } catch (err) {
      return {
        ok: false,
        reason: `LLM error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const parsed = parseJsonLoose<{ rewritten?: unknown }>(raw);
    const rewritten =
      parsed && typeof parsed.rewritten === "string" ? parsed.rewritten.trim() : "";
    if (!rewritten) {
      feedback =
        "Your previous response was not valid JSON with a 'rewritten' string. Output JSON only.";
      continue;
    }

    const audit = auditBulletOnly(rewritten, profile);
    if (audit.passed) {
      return { ok: true, text: rewritten };
    }

    if (attempt < MAX_RETRIES) {
      feedback = `You fabricated: ${audit.reasons.join("; ")}. Do not include any of those. Rewrite using ONLY facts from the original summary.`;
      continue;
    }
    return {
      ok: false,
      reason: `summary audit failed after ${MAX_RETRIES + 1} attempts: ${audit.reasons.join("; ")}`,
    };
  }

  return { ok: false, reason: "exhausted retries with no parseable output" };
}

// ── C. Skill label rewriter ──────────────────────────────────────────

/**
 * Find the best JD-vocabulary label for a profile skill, but ONLY when the
 * profile skill and the JD term map to the same canonical synonym entry.
 *
 * Example:
 *   profile skill: "Postgres"
 *   JD relevant skills (from tailored or text): ["PostgreSQL"]
 *   synonyms.json maps both → canonical key "postgresql"
 *   → return "PostgreSQL"
 *
 * If no JD term resolves to the same canonical, we don't propose a relabel.
 * We never invent a label that isn't already in the JD's text.
 */
function relabelSkillForJd(
  profileSkill: string,
  jdTermsByCanonical: Map<string, string>,
): string | null {
  const canon = canonicalKeyFor(profileSkill);
  if (!canon) return null;

  // If the JD uses a variant of the same canonical, prefer the JD's verbatim
  // surface form (already lowercased in the map values? — we keep verbatim).
  const jdLabel = jdTermsByCanonical.get(canon);
  if (jdLabel && jdLabel.toLowerCase() !== profileSkill.toLowerCase()) {
    return jdLabel;
  }

  // No JD term shares the canonical → don't relabel.
  return null;
}

function buildJdTermCanonicalMap(jdText: string, tailored: TailoredResume): Map<string, string> {
  // We try to discover JD-surface labels for canonicals.
  // Strategy:
  //   1. Walk known variants — if a variant appears in jdText, remember the
  //      surface form (as it appeared in the JD) keyed by its canonical.
  //   2. Layer tailored.relevantSkills + missingKeywords on top so the JD
  //      vocabulary surfaces even when the variant matcher missed casing.
  const out = new Map<string, string>();
  const jdLower = jdText.toLowerCase();

  const considerTerm = (term: string) => {
    const canon = canonicalKeyFor(term);
    if (!canon) return;
    // Prefer a JD-verbatim surface form. Find the first case-preserving
    // occurrence of the canonical's display in jdText, or fall back to the
    // term as-passed.
    const display = displayForCanonical(canon);
    const idx = jdText.toLowerCase().indexOf(display.toLowerCase());
    if (idx !== -1) {
      out.set(canon, jdText.slice(idx, idx + display.length));
    } else if (!out.has(canon)) {
      out.set(canon, term);
    }
  };

  // Walk variants and probe the JD.
  VARIANT_TO_CANONICAL_KEY.forEach((canon, variant) => {
    if (variant.length < 2) return;
    if (jdLower.includes(variant)) {
      const idx = jdLower.indexOf(variant);
      const surface = jdText.slice(idx, idx + variant.length);
      // Prefer the canonical display when we already saw it verbatim — else
      // keep the first surface form we found.
      if (!out.has(canon)) out.set(canon, surface);
    }
  });

  for (const s of tailored.relevantSkills) considerTerm(s);
  for (const s of tailored.missingKeywords) considerTerm(s);

  return out;
}

function rewriteSkillLabels(
  profile: ResumeProfile,
  tailored: TailoredResume,
  jdText: string,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!profile.skills?.length) return map;
  const jdTermsByCanonical = buildJdTermCanonicalMap(jdText, tailored);

  for (const profileSkill of profile.skills) {
    const proposed = relabelSkillForJd(profileSkill, jdTermsByCanonical);
    if (proposed && proposed !== profileSkill) {
      map.set(profileSkill, proposed);
    }
  }
  return map;
}

// ── D. Final whole-resume audit ──────────────────────────────────────

function composeRewrittenText(
  profile: ResumeProfile,
  rewrittenSummary: string | null,
  rewrittenBullets: Map<string, string>,
  rewrittenSkillLabels: Map<string, string>,
): string {
  const parts: string[] = [];

  // Skills, relabeled where we proposed a JD-aligned label.
  if (profile.skills?.length) {
    const relabeled = profile.skills.map((s) => rewrittenSkillLabels.get(s) ?? s);
    parts.push(relabeled.join(", "));
  }

  if (rewrittenSummary) {
    parts.push(rewrittenSummary);
  }

  // Experiences — header line + (possibly rewritten) bullets.
  for (const exp of profile.experiences) {
    parts.push(
      `${exp.title} — ${exp.company} (${exp.startDate}${exp.endDate ? ` - ${exp.endDate}` : ""})`,
    );
    for (const b of exp.bullets) {
      parts.push(rewrittenBullets.get(b) ?? b);
    }
  }

  // Projects.
  for (const proj of profile.projects) {
    parts.push(`${proj.title}${proj.role ? ` — ${proj.role}` : ""}`);
    if (proj.oneLiner) parts.push(proj.oneLiner);
    for (const b of proj.bullets) {
      parts.push(rewrittenBullets.get(b) ?? b);
    }
  }

  return parts.join("\n");
}

// ── E. Public entry point ────────────────────────────────────────────

export async function rewriteResume(input: RewriteInput): Promise<RewriteResult> {
  const { profile, tailored, jdText, quota } = input;
  const warnings: string[] = [];

  // (A) Bullets — bounded parallel (concurrency 5) to keep total wall-clock
  //     under ~3-4s for a typical 20-bullet profile. Bullets that fail audit
  //     fall back to the original verbatim.
  const rewrittenBullets = new Map<string, string>();
  const bullets = collectBullets(profile);
  const relevantJdKeywords = tailored.relevantSkills.slice(0, 12);

  const CONCURRENCY = 5;
  for (let i = 0; i < bullets.length; i += CONCURRENCY) {
    const slice = bullets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (original) => {
        try {
          const r = await rewriteOneBullet(original, relevantJdKeywords, profile, quota);
          return { original, r };
        } catch (err) {
          return {
            original,
            r: {
              ok: false as const,
              reason: `bullet rewrite threw — ${err instanceof Error ? err.message : String(err)}`,
            },
          };
        }
      }),
    );
    for (const { original, r } of results) {
      if (r.ok) {
        if (r.text !== original) rewrittenBullets.set(original, r.text);
      } else {
        warnings.push(`bullet kept original — ${r.reason}`);
      }
    }
  }

  // (B) Summary.
  let rewrittenSummary: string | null = null;
  try {
    const s = await rewriteSummary(profile, tailored, jdText, quota);
    if (s.ok === true) {
      rewrittenSummary = s.text;
    } else if (s.ok === false) {
      warnings.push(`summary kept original — ${s.reason}`);
      const picked = pickClosestSummary(profile, jdText.toLowerCase());
      rewrittenSummary = picked?.content ?? null;
    } else {
      // skipped (no summaries on profile)
      rewrittenSummary = null;
    }
  } catch (err) {
    warnings.push(
      `summary rewrite threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    const picked = pickClosestSummary(profile, jdText.toLowerCase());
    rewrittenSummary = picked?.content ?? null;
  }

  // (C) Skill labels — synchronous, no LLM call.
  const rewrittenSkillLabels = rewriteSkillLabels(profile, tailored, jdText);

  // (D) Final audit over the composed rewritten resume.
  const composed = composeRewrittenText(
    profile,
    rewrittenSummary,
    rewrittenBullets,
    rewrittenSkillLabels,
  );
  const auditResult = runAuditLayers({
    renderedText: composed,
    profile,
    jdText,
  });

  if (!auditResult.passed) {
    if (auditResult.hardFabrications.length > 0) {
      warnings.push(
        `whole-resume audit flagged hard fabrications: ${auditResult.hardFabrications.join(", ")}`,
      );
    }
    if (auditResult.numberFabrications.length > 0) {
      warnings.push(
        `whole-resume audit flagged number fabrications: ${auditResult.numberFabrications.join(", ")}`,
      );
    }
    if (auditResult.dateMismatches.length > 0) {
      warnings.push(
        `whole-resume audit flagged date mismatches: ${auditResult.dateMismatches.join(" | ")}`,
      );
    }
  }

  return {
    rewrittenSummary,
    rewrittenBullets,
    rewrittenSkillLabels,
    auditResult,
    warnings,
  };
}
