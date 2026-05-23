/**
 * AI Bullet Coach
 *
 * Turns a weak resume bullet ("worked on payments") into a strong one
 * ("Built idempotent webhook handler processing 12K/day in Stripe events;
 *  cut duplicate-charge incidents from 4/wk to 0").
 *
 * STRICT rules:
 *   - Never invent metrics. If the user didn't say "12K/day", the coach
 *     can SUGGEST a placeholder ([N]/day) but must never assert a number.
 *   - Never invent technologies. Only use stack items in the user's profile.
 *   - Preserve all factual claims from the original bullet.
 *   - Action verb first, results second, technique third.
 *
 * Output includes diff fields so the UI can show original vs improved and
 * the user can accept/edit/reject.
 */

import { z } from "zod";
import { generateWithGroq } from "@/lib/groq";

export const BulletCoachInputSchema = z.object({
  bullet: z.string().trim().min(3).max(600),
  /** Role context — title + company so the coach knows the domain. */
  role: z.object({
    title: z.string().max(120),
    company: z.string().max(120),
  }),
  /** Optional JD text — when present, the coach biases toward JD keywords already in the user's stack. */
  jdText: z.string().max(8000).optional(),
  /** The user's actual skills — coach MAY use these, MUST NOT introduce new ones. */
  userSkills: z.array(z.string()).max(80).default([]),
  /** Coaching depth — "tighten" keeps original intent, "rewrite" allows more rephrasing. */
  mode: z.enum(["tighten", "rewrite"]).default("tighten"),
});
export type BulletCoachInput = z.infer<typeof BulletCoachInputSchema>;

export const BulletCoachResultSchema = z.object({
  original: z.string(),
  improved: z.string(),
  /** Per-bullet rationale: one sentence on what changed and why. */
  rationale: z.string(),
  /** Flagged words the coach injected as placeholders user must fill — e.g. ["[N]"]. */
  placeholders: z.array(z.string()).default([]),
  /** Confidence 0-1: low when the original is too vague to coach without inventing facts. */
  confidence: z.number().min(0).max(1),
});
export type BulletCoachResult = z.infer<typeof BulletCoachResultSchema>;

const SYSTEM_PROMPT = `You are a resume bullet coach. Rewrite weak resume bullets into strong ones.

HARD RULES (violations = bullet is rejected):
- NEVER invent metrics, dates, percentages, team sizes, or revenue.
- If the original bullet lacks a number, use a placeholder like "[N]", "[%]", "[X hours/week]" — never assert a specific value.
- NEVER add a technology or tool the user did not list in their stack.
- Preserve every factual claim from the original. Don't replace "led" with "managed" if user said "led."
- Output VALID JSON ONLY, no markdown, no explanation.

GUIDELINES:
- Start with an action verb (Built, Shipped, Led, Architected, Migrated, Cut, Drove, Designed).
- Result/impact second (LCP cut from 4.2s → 1.6s; latency reduced 35%; revenue +$1.4M ARR; …).
- Technique/scope third (across N services; via GraphQL federation; …).
- 1 line max, ~18-30 words. Punchy. No filler ("responsible for", "involved in").

OUTPUT FORMAT:
{
  "improved": "rewritten bullet, single line",
  "rationale": "one sentence explaining what changed and why",
  "placeholders": ["[N]", "[%]"],
  "confidence": 0.85
}`;

function buildUserPrompt(input: BulletCoachInput): string {
  const parts = [
    `Original bullet:\n${input.bullet}`,
    `Role: ${input.role.title} at ${input.role.company}`,
    input.userSkills.length > 0
      ? `User's actual stack (you MAY reference these, MUST NOT add new ones):\n${input.userSkills.slice(0, 30).join(", ")}`
      : "User's actual stack: not provided.",
    input.jdText
      ? `Target job description (bias toward keywords already in the stack):\n${input.jdText.slice(0, 2000)}`
      : "",
    `Mode: ${input.mode === "tighten" ? "Tighten — keep intent, sharpen language and structure." : "Rewrite — restructure freely while preserving facts."}`,
    "Output the improved bullet as JSON.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

const RawSchema = z.object({
  improved: z.string().trim().min(3),
  rationale: z.string().trim().min(3).max(280),
  placeholders: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.7),
});

export async function coachBullet(
  rawInput: BulletCoachInput,
  opts: { quota?: { userId: string; route: string } } = {},
): Promise<BulletCoachResult> {
  const input = BulletCoachInputSchema.parse(rawInput);

  const raw = await generateWithGroq(SYSTEM_PROMPT, buildUserPrompt(input), {
    temperature: 0.3,
    max_tokens: 280,
    model: "llama-3.3-70b-versatile",
    quota: opts.quota,
  });

  let parsed: z.infer<typeof RawSchema>;
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    parsed = RawSchema.parse(JSON.parse(cleaned));
  } catch {
    return {
      original: input.bullet,
      improved: input.bullet,
      rationale: "Coach output unparseable — keeping original. Try again or rewrite manually.",
      placeholders: [],
      confidence: 0,
    };
  }

  // No-fabrication audit: any non-placeholder digit in `improved` that wasn't
  // in the original is a hallucinated metric — reject it.
  const orig = input.bullet.toLowerCase();
  const improved = parsed.improved;
  const numbersInImproved = improved.match(/\b\d+(?:[.,]\d+)?[%kKmM+]?\b/g) ?? [];
  const fabricated = numbersInImproved.filter((n) => !orig.includes(n.toLowerCase()));
  if (fabricated.length > 0) {
    // Strip fabricated numbers — replace each with the canonical placeholder.
    let scrubbed = improved;
    for (const n of fabricated) {
      // Don't replace numbers that are already inside a [bracket] placeholder
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      scrubbed = scrubbed.replace(new RegExp(`(?<!\\[)${escaped}`, "g"), "[N]");
    }
    return {
      original: input.bullet,
      improved: scrubbed,
      rationale: `${parsed.rationale} (Coach flagged ${fabricated.length} unverified number${fabricated.length > 1 ? "s" : ""} — replaced with [N] for you to fill.)`,
      placeholders: Array.from(new Set([...parsed.placeholders, "[N]"])),
      confidence: Math.min(parsed.confidence, 0.5),
    };
  }

  return {
    original: input.bullet,
    improved: parsed.improved,
    rationale: parsed.rationale,
    placeholders: parsed.placeholders,
    confidence: parsed.confidence,
  };
}
