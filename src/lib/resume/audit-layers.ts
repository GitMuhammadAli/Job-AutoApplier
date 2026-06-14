/**
 * 4-layer fabrication audit.
 *
 * This is a SECOND audit pass that runs alongside the strict substring audit
 * in audit.ts. Where audit.ts asks "did every visible word exist in the input
 * blob?", this one asks the harder semantic questions:
 *
 *   LAYER 1 — Hard prohibitions: technology mentions that aren't in the
 *             profile's skills (via the synonym registry) and aren't backed
 *             by a derivation rule with enough evidence.
 *   LAYER 2 — Numbers: percentages, dollar amounts, scale claims ("400+ users",
 *             "3x faster") that don't appear in the profile.
 *   LAYER 3 — Date/title triplets: (company, title, dateRange) tuples in the
 *             rendered text must align with profile.experiences.
 *   LAYER 4 — Soft warnings: strong verbs / scale adjectives that the profile
 *             doesn't support. These DON'T block — they inform the user that
 *             a claim looks aggressive vs the underlying profile.
 *
 * Synonym + derivation files are loaded defensively at module init. If either
 * is missing, layers 2-4 still run; layer 1 degrades gracefully (it will only
 * flag tokens that are obviously not in the raw skills list — no semantic
 * matching).
 *
 * This file is intentionally pure / stateless after the one-time JSON read.
 * Safe to call per-render. No I/O beyond the boot-time fs.readFileSync.
 */

import fs from "node:fs";
import path from "node:path";
import type { ResumeProfile } from "./types";

// ── Public types ─────────────────────────────────────────────────────

export type SoftWarningKind = "strong_verb" | "scale_claim" | "seniority_mismatch";

export interface SoftWarning {
  kind: SoftWarningKind;
  term: string;
  context: string;
}

export interface AuditResult {
  hardFabrications: string[];
  numberFabrications: string[];
  dateMismatches: string[];
  softWarnings: SoftWarning[];
  passed: boolean;
}

export interface AuditLayersInput {
  renderedText: string;
  profile: ResumeProfile;
  jdText?: string;
}

// ── Synonym + derivation registries ──────────────────────────────────
//
// Expected shapes — kept loose so different authoring styles don't break
// boot. Both files are optional.
//
// synonyms.json:
//   {
//     "<canonical>": {
//       "variants": ["k8s", "kube", "kubernetes"],   // case-insensitive substrings
//       ...
//     },
//     ...
//   }
//
// derivations.json:
//   {
//     "<canonical>": {
//       "evidence_patterns": ["docker", "container", "helm"],
//       "min_evidence": 2     // optional; defaults to 2
//     },
//     ...
//   }

interface SynonymEntry {
  variants: string[];
}
interface DerivationEntry {
  evidence_patterns: string[];
  min_evidence?: number;
}

type SynonymRegistry = Record<string, SynonymEntry>;
type DerivationRegistry = Record<string, DerivationEntry>;

function safeLoadJson<T>(relPath: string): T | null {
  // Probe a few likely locations. The data dir doesn't exist yet at the
  // time of writing — be defensive about it.
  const candidates = [
    path.resolve(process.cwd(), "src/lib/resume", relPath),
    path.resolve(process.cwd(), "src/data/resume", relPath),
    path.resolve(process.cwd(), "data/resume", relPath),
    path.resolve(__dirname, relPath),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw) as T;
      }
    } catch {
      // ignore — try next candidate
    }
  }
  return null;
}

const SYNONYMS: SynonymRegistry = safeLoadJson<SynonymRegistry>("synonyms.json") ?? {};

/**
 * derivations.json is authored as an ARRAY of rules (id/claim/evidence_patterns/min_matches)
 * for hand-editability. The runtime needs O(1) lookup by canonical-of-claim.
 * Adapt: fold array → Record<lowercased-claim, {evidence_patterns, min_evidence}>.
 * Also accept the object shape directly for forward-compat.
 */
type DerivationArrayEntry = {
  id?: string;
  claim?: string;
  category?: string;
  evidence_patterns?: string[];
  min_matches?: number;
  min_evidence?: number;
};

function normalizeDerivations(
  raw: unknown,
): DerivationRegistry {
  if (!raw) return {};
  // Already an object map
  if (!Array.isArray(raw) && typeof raw === "object") {
    return raw as DerivationRegistry;
  }
  // Array form — fold to map by canonical key
  if (Array.isArray(raw)) {
    const out: DerivationRegistry = {};
    for (const entry of raw as DerivationArrayEntry[]) {
      if (!entry || typeof entry !== "object") continue;
      const keySource = entry.claim || entry.id || "";
      const canonical = String(keySource).toLowerCase().trim();
      if (!canonical) continue;
      const evidence = Array.isArray(entry.evidence_patterns)
        ? entry.evidence_patterns
        : [];
      if (evidence.length === 0) continue;
      const min =
        typeof entry.min_evidence === "number"
          ? entry.min_evidence
          : typeof entry.min_matches === "number"
            ? entry.min_matches
            : 2;
      out[canonical] = { evidence_patterns: evidence, min_evidence: min };
    }
    return out;
  }
  return {};
}

const DERIVATIONS: DerivationRegistry = normalizeDerivations(
  safeLoadJson<unknown>("derivations.json"),
);

// Precompute (variant → canonical) so we can identify which canonical a
// rendered-text token belongs to in O(1). Lowercased throughout.
const VARIANT_TO_CANONICAL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canonical, entry] of Object.entries(SYNONYMS)) {
    const canon = canonical.toLowerCase();
    m.set(canon, canon);
    if (entry && Array.isArray(entry.variants)) {
      for (const v of entry.variants) {
        if (typeof v === "string" && v.trim()) {
          m.set(v.toLowerCase().trim(), canon);
        }
      }
    }
  }
  return m;
})();

// All known variants, sorted longest-first so "react native" matches before
// "react" when both are present in renderedText.
const ALL_VARIANTS: string[] = Array.from(VARIANT_TO_CANONICAL.keys()).sort(
  (a, b) => b.length - a.length,
);

// ── Helpers ──────────────────────────────────────────────────────────

function lower(s: string): string {
  return s.toLowerCase();
}

/** Concatenate the entire profile text content into one lowercased blob. */
function profileBlob(profile: ResumeProfile): string {
  const parts: string[] = [];
  const visit = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(profile);
  return parts.join(" ").toLowerCase();
}

/** Lowercase set of profile skills for fast lookup. */
function skillsLower(profile: ResumeProfile): Set<string> {
  return new Set(profile.skills.map((s) => s.toLowerCase().trim()));
}

/**
 * Word-boundary-aware substring search. Avoids matching "go" inside "going".
 * For multi-word variants ("react native") just uses raw substring.
 */
function containsTerm(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.includes(" ")) return haystack.includes(needle);
  // Use a regex with word boundaries (or non-alphanumeric flanks).
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, "i");
  return re.test(haystack);
}

// ── LAYER 1 — Hard prohibitions (technology fabrication) ─────────────

function layer1HardFabrications(
  renderedTextLower: string,
  profile: ResumeProfile,
  profileBlobLower: string,
): string[] {
  if (ALL_VARIANTS.length === 0) {
    // No synonym registry → we can't reason semantically. Skip layer 1
    // (audit.ts already catches verbatim fabrications).
    return [];
  }

  const skills = skillsLower(profile);
  const fabricated = new Set<string>();
  // Track which spans we've consumed so we don't double-flag a substring
  // inside an already-matched longer variant ("react" inside "react native").
  const consumedSpans: Array<[number, number]> = [];
  const overlaps = (s: number, e: number): boolean =>
    consumedSpans.some(([a, b]) => s < b && e > a);

  for (const variant of ALL_VARIANTS) {
    const canonical = VARIANT_TO_CANONICAL.get(variant)!;

    // Walk every occurrence in the rendered text.
    let from = 0;
    while (from <= renderedTextLower.length) {
      const idx = renderedTextLower.indexOf(variant, from);
      if (idx === -1) break;
      const end = idx + variant.length;

      // Enforce word-boundary on single-word variants.
      const isMultiword = variant.includes(" ");
      const prev = idx === 0 ? " " : renderedTextLower[idx - 1];
      const next = end >= renderedTextLower.length ? " " : renderedTextLower[end];
      const wordBoundary =
        isMultiword || (!/[a-z0-9+#]/.test(prev) && !/[a-z0-9+#]/.test(next));

      if (wordBoundary && !overlaps(idx, end)) {
        consumedSpans.push([idx, end]);

        // Resolution checks for this canonical:
        //   (a) canonical or any of its variants appear in profile.skills
        //   (b) canonical or any variant appears in the profile blob (covers
        //       skills/projects/experience bullets that legitimately name it)
        //   (c) a derivation rule grants this canonical based on enough
        //       evidence_patterns hitting the profile blob
        let resolved = skills.has(canonical);

        if (!resolved) {
          const synEntry = SYNONYMS[canonical];
          const variants = synEntry?.variants ?? [];
          for (const v of [canonical, ...variants]) {
            if (skills.has(v.toLowerCase())) {
              resolved = true;
              break;
            }
          }
        }

        if (!resolved) {
          // Allow profile-blob mentions (e.g. inside a project bullet) too.
          if (containsTerm(profileBlobLower, canonical)) resolved = true;
          if (!resolved) {
            const synEntry = SYNONYMS[canonical];
            const variants = synEntry?.variants ?? [];
            for (const v of variants) {
              if (containsTerm(profileBlobLower, v.toLowerCase())) {
                resolved = true;
                break;
              }
            }
          }
        }

        if (!resolved) {
          const deriv = DERIVATIONS[canonical];
          if (deriv && Array.isArray(deriv.evidence_patterns)) {
            const min = typeof deriv.min_evidence === "number" ? deriv.min_evidence : 2;
            let hits = 0;
            for (const pat of deriv.evidence_patterns) {
              if (typeof pat === "string" && containsTerm(profileBlobLower, pat.toLowerCase())) {
                hits += 1;
                if (hits >= min) break;
              }
            }
            if (hits >= min) resolved = true;
          }
        }

        if (!resolved) fabricated.add(canonical);
      }

      from = end > from ? end : from + 1;
    }
  }

  return Array.from(fabricated);
}

// ── LAYER 2 — Number / scale fabrication ─────────────────────────────

const NUMBER_REGEXES: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*%/g,                                          // 40%, 12.5 %
  /\$\s?\d+(?:[.,]\d+)?\s?[kmb]?\b/gi,                             // $400, $1.2M, $5k
  /\b\d+(?:[.,]\d+)?\s?[kmb]?\+?\s+(?:users|customers|clients|requests?|hours?|x|times?|members|engineers|countries|teams|projects|companies|orgs|organizations|deployments|transactions|queries|messages|sessions|downloads|installs|seconds|days|weeks|months|years)\b/gi,
  /\b\d+(?:\.\d+)?x\b/gi,                                          // 3x, 10x faster
];

/** Map a verbal/textual scale token to a normalized numeric value, or null. */
function normalizeNumberPhrase(raw: string): number | null {
  const s = raw.toLowerCase().trim();
  // strip $ and commas
  const cleaned = s.replace(/[$,]/g, "").trim();
  // Detect % → fraction (40% → 0.4)
  const pct = cleaned.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (pct) return parseFloat(pct[1]) / 100;
  // "x faster" → number
  const mx = cleaned.match(/^(\d+(?:\.\d+)?)x\b/);
  if (mx) return parseFloat(mx[1]);
  // Plain number with optional k/m/b suffix
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s?([kmb])?/);
  if (m) {
    let n = parseFloat(m[1]);
    const suf = m[2];
    if (suf === "k") n *= 1_000;
    else if (suf === "m") n *= 1_000_000;
    else if (suf === "b") n *= 1_000_000_000;
    return n;
  }
  return null;
}

function layer2NumberFabrications(renderedTextLower: string, profileBlobLower: string): string[] {
  const fabricated: string[] = [];
  const seen = new Set<string>();

  for (const re of NUMBER_REGEXES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(renderedTextLower)) !== null) {
      const phrase = m[0].trim();
      if (seen.has(phrase)) continue;
      seen.add(phrase);

      // Quick win: exact substring match anywhere in the profile blob.
      if (profileBlobLower.includes(phrase)) continue;

      // Try numeric equivalence — same number could be in profile differently
      // ("40%" in render vs "0.4" or "40 percent" in profile).
      const n = normalizeNumberPhrase(phrase);
      if (n != null) {
        const candidates: string[] = [];
        candidates.push(String(n));
        if (n < 1) candidates.push(`${Math.round(n * 100)}%`, `${Math.round(n * 100)} percent`);
        if (n >= 1 && n < 100 && Number.isInteger(n)) candidates.push(`${n}x`, `${n} times`);
        if (n >= 1000) {
          candidates.push(`${Math.round(n / 1000)}k`, `${Math.round(n / 1000)}K`);
        }
        if (n >= 1_000_000) {
          candidates.push(`${Math.round(n / 1_000_000)}m`, `${Math.round(n / 1_000_000)}M`);
        }
        // Also handle "two-fifths" style — we don't enumerate; if normalize
        // gives 0.4 we'd also accept "two-fifths" iff it appears verbatim.
        if (candidates.some((c) => profileBlobLower.includes(c.toLowerCase()))) continue;
      }

      fabricated.push(phrase);
    }
  }

  return fabricated;
}

// ── LAYER 3 — Date / title triplet check ─────────────────────────────

// Best-effort recogniser for common resume patterns. We pull out (company,
// title, dateRange) candidates from rendered text and cross-check that the
// profile contains a matching experience entry.
//
// Patterns covered:
//   "Senior Engineer — Stripe (Jan 2022 – Present)"
//   "Stripe — Senior Engineer, 2022 – 2024"
//   "Stripe | Senior Engineer | 2022 - Present"
//
// We do not try to be exhaustive — if extraction misses, we under-flag, which
// is the safe direction (the verbatim audit still runs).

const DATE_TOKEN =
  "(?:" +
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?\\s*\\d{4}" +
  "|\\d{1,2}/\\d{4}" +
  "|\\d{4}" +
  "|Present|Current" +
  ")";
const DATE_RANGE = `${DATE_TOKEN}\\s*(?:[-–—]|to)\\s*${DATE_TOKEN}`;

interface RenderedTriplet {
  raw: string;
  left: string;
  right: string;
  dateRange: string;
}

function extractTriplets(renderedText: string): RenderedTriplet[] {
  const out: RenderedTriplet[] = [];
  // Split into lines so a date range from one experience can't bleed into
  // the next entry's company name.
  const lines = renderedText.split(/\r?\n/);
  const triRe = new RegExp(
    `([A-Z][A-Za-z0-9&.\\- ]{1,60}?)\\s*[—\\-|·]\\s*([A-Z][A-Za-z0-9&.\\- /]{1,60}?)\\s*[(,\\-—|·]?\\s*(${DATE_RANGE})`,
    "g",
  );
  for (const line of lines) {
    triRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = triRe.exec(line)) !== null) {
      out.push({
        raw: m[0],
        left: m[1].trim(),
        right: m[2].trim(),
        dateRange: m[3].trim(),
      });
    }
  }
  return out;
}

/** Pull the 4-digit years out of a date range string. */
function yearsIn(s: string): string[] {
  return Array.from(s.matchAll(/\b(19|20)\d{2}\b/g)).map((m) => m[0]);
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function layer3DateMismatches(renderedText: string, profile: ResumeProfile): string[] {
  const mismatches: string[] = [];
  const triplets = extractTriplets(renderedText);
  if (triplets.length === 0) return mismatches;

  const profileEntries = profile.experiences.map((e) => ({
    companyNorm: normalizeForMatch(e.company),
    titleNorm: normalizeForMatch(e.title),
    startYears: yearsIn(e.startDate),
    endYears: e.endDate ? yearsIn(e.endDate) : [],
    rawRange: `${e.startDate} ${e.endDate ?? ""}`.toLowerCase(),
  }));

  for (const t of triplets) {
    const leftNorm = normalizeForMatch(t.left);
    const rightNorm = normalizeForMatch(t.right);
    const tripletYears = yearsIn(t.dateRange);
    const tripletHasPresent = /present|current/i.test(t.dateRange);

    // Company can be on either side of the separator in the wild.
    const matched = profileEntries.some((e) => {
      const companyMatches =
        e.companyNorm === leftNorm ||
        e.companyNorm === rightNorm ||
        (e.companyNorm.length >= 3 &&
          (leftNorm.includes(e.companyNorm) || rightNorm.includes(e.companyNorm)));
      if (!companyMatches) return false;

      // Date alignment: every year in the rendered triplet must appear in the
      // profile entry's start or end date string. "Present" matches a missing
      // endDate or an endDate containing "present".
      const allYearsKnown = tripletYears.every(
        (y) => e.startYears.includes(y) || e.endYears.includes(y),
      );
      const presentOk = tripletHasPresent
        ? !e.endYears.length || /present|current/i.test(e.rawRange)
        : true;
      return allYearsKnown && presentOk;
    });

    if (!matched) mismatches.push(t.raw);
  }

  return mismatches;
}

// ── LAYER 4 — Soft warnings ──────────────────────────────────────────

const STRONG_VERBS = [
  "led",
  "directed",
  "owned",
  "spearheaded",
  "pioneered",
  "championed",
  "orchestrated",
  "headed",
];

const SCALE_ADJECTIVES = [
  "enterprise",
  "production-grade",
  "production grade",
  "high-throughput",
  "high throughput",
  "fortune 500",
  "billion-dollar",
  "billion dollar",
  "mission-critical",
  "mission critical",
  "world-class",
  "world class",
];

const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|principal|lead|head|director|vp|chief|founder|co-?founder|architect)\b/i;

function isSenior(profile: ResumeProfile): boolean {
  return profile.experiences.some((e) => SENIOR_TITLE_RE.test(e.title));
}

/** Pick a ~80-char window around `idx` in `text` for the warning context. */
function snippet(text: string, idx: number, length: number): string {
  const pad = 30;
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + length + pad);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function findAll(text: string, term: string): number[] {
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const out: number[] = [];
  let from = 0;
  while (from <= lower.length) {
    const i = lower.indexOf(t, from);
    if (i === -1) break;
    // word boundary
    const prev = i === 0 ? " " : lower[i - 1];
    const next = i + t.length >= lower.length ? " " : lower[i + t.length];
    if (!/[a-z0-9]/.test(prev) && !/[a-z0-9]/.test(next)) out.push(i);
    from = i + t.length;
  }
  return out;
}

function layer4SoftWarnings(
  renderedText: string,
  profile: ResumeProfile,
  profileBlobLower: string,
): SoftWarning[] {
  const warnings: SoftWarning[] = [];
  const senior = isSenior(profile);

  // Strong verbs vs non-senior profile.
  if (!senior) {
    for (const v of STRONG_VERBS) {
      for (const i of findAll(renderedText, v)) {
        warnings.push({
          kind: "strong_verb",
          term: v,
          context: snippet(renderedText, i, v.length),
        });
      }
    }
  }

  // Scale adjectives without supporting evidence in the profile.
  for (const adj of SCALE_ADJECTIVES) {
    for (const i of findAll(renderedText, adj)) {
      if (!profileBlobLower.includes(adj.toLowerCase())) {
        warnings.push({
          kind: "scale_claim",
          term: adj,
          context: snippet(renderedText, i, adj.length),
        });
      }
    }
  }

  // Seniority mismatch: render claims senior title that the profile never held.
  if (!senior) {
    const m = renderedText.match(SENIOR_TITLE_RE);
    if (m && m.index != null) {
      warnings.push({
        kind: "seniority_mismatch",
        term: m[0],
        context: snippet(renderedText, m.index, m[0].length),
      });
    }
  }

  return warnings;
}

// ── Public entry point ──────────────────────────────────────────────

export function runAuditLayers(input: AuditLayersInput): AuditResult {
  const renderedTextLower = lower(input.renderedText);
  const blob = profileBlob(input.profile);

  const hardFabrications = layer1HardFabrications(renderedTextLower, input.profile, blob);
  const numberFabrications = layer2NumberFabrications(renderedTextLower, blob);
  const dateMismatches = layer3DateMismatches(input.renderedText, input.profile);
  const softWarnings = layer4SoftWarnings(input.renderedText, input.profile, blob);

  const passed =
    hardFabrications.length === 0 &&
    numberFabrications.length === 0 &&
    dateMismatches.length === 0;

  return {
    hardFabrications,
    numberFabrications,
    dateMismatches,
    softWarnings,
    passed,
  };
}
