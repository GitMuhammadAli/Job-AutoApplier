/**
 * Anti-fabrication audit.
 *
 * The MOST important file in the resume generator. This is what enforces
 * "manage, not rewrite" — the hard rule the user committed to.
 *
 * Contract:
 *   1. Take the typed render input (verbatim user data).
 *   2. Take the rendered HTML output.
 *   3. Extract every "content word" from the HTML (visible text, ≥ 4 chars,
 *      skipping section labels + structural words).
 *   4. Every content word must appear as a substring of the lowercased input
 *      blob. If even ONE doesn't, the audit fails.
 *
 * If a future template change accidentally introduces a word that wasn't
 * in the input (a hardcoded label, a tooltip, an em dash translation), the
 * audit throws — and CI / the generation request fails loudly.
 *
 * The render dispatcher (render.ts) runs this on every generation. There is
 * no "skip audit" bypass — the only way to add a new visible string to the
 * output is to add it to the STRUCTURAL_TOKENS allowlist below, which is a
 * code review checkpoint.
 */

import type { ResumeRenderInput } from "./types";

/**
 * Words that legitimately appear in any resume regardless of user content.
 * Section headers, common short words, punctuation translations.
 *
 * RULE: this list grows ONLY through code review. If a template needs a new
 * structural word, add it here intentionally. Never broaden the regex.
 */
const STRUCTURAL_TOKENS = new Set<string>([
  // Section headers (rendered by templates, not user-authored)
  "summary",
  "skills",
  "experience",
  "education",
  "projects",
  "selected",
  "certifications",
  "credential",
  "live",

  // Short connector words that templates concatenate around user content
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "your",
  "you",
  "are",
  "was",
  "they",
  "this",
  "that",
  "these",
  "those",
  "have",
  "will",
  "page",
  "resume",
  "based",
  "more",

  // Punctuation translations (HTML entities → readable text)
  "ndash",
  "mdash",
  "nbsp",

  // Template versioning
  "jobpilot",
  "generator",
  "t01",
  "version",
]);

export interface AuditResult {
  ok: boolean;
  /** Tokens that failed the substring check (capped to first 50 for log readability). */
  fabricated: string[];
  /** Total content tokens checked. */
  totalTokens: number;
}

export class FabricationError extends Error {
  fabricated: string[];
  constructor(fabricated: string[]) {
    super(
      `Audit FAIL — ${fabricated.length} word(s) appeared in output but not input: ` +
        fabricated.slice(0, 20).join(", "),
    );
    this.name = "FabricationError";
    this.fabricated = fabricated;
  }
}

/** Recursively flatten every string in the input into a single blob. */
function collectInputStrings(input: ResumeRenderInput): string {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(input);
  return out.join(" ").toLowerCase();
}

/**
 * Strip tags, decode entities, lowercase. Returns the "user-visible" text
 * that a recruiter would read after print/copy-paste.
 */
function extractVisibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Run the audit. Returns a structured result rather than throwing so the
 * caller can decide whether to abort or just log (CI vs interactive).
 */
export function auditNoFabrication(
  input: ResumeRenderInput,
  html: string,
): AuditResult {
  const visible = extractVisibleText(html);
  const inputBlob = collectInputStrings(input);

  // Tokenize: words ≥ 4 chars made of letters/numbers. Skips structural noise.
  const tokens = visible
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STRUCTURAL_TOKENS.has(t));

  const fabricated: string[] = [];
  for (const t of tokens) {
    if (!inputBlob.includes(t)) {
      fabricated.push(t);
    }
  }
  // Dedupe so an over-and-over fabrication shows once.
  const uniqueFabricated = Array.from(new Set(fabricated));

  return {
    ok: uniqueFabricated.length === 0,
    fabricated: uniqueFabricated,
    totalTokens: tokens.length,
  };
}
