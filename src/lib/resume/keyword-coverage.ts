/**
 * Deterministic JD ↔ profile keyword coverage.
 *
 * The bug this fixes: `fillTemplate()` (Agent 5) returns LLM-ranked
 * `projectIds`. With pageTarget=1, only top-3 projects render. The LLM can
 * decide "this project is less relevant" and drop a project even when its
 * bullets/stack contain a verbatim JD keyword the user has. An ATS that
 * grep-matches that keyword then rejects the resume — exactly what happened
 * with the WebRTC keyword in real prod use.
 *
 * Fix: after fillTemplate, run a deterministic post-pass that extracts JD
 * keywords using the existing tokenize/extractPhrases logic, scans the user's
 * profile for verbatim matches, and force-includes any project/skill that
 * carries a keyword which would otherwise be missing from the rendered PDF.
 *
 * Hard rule preserved: this NEVER adds anything the user doesn't have.
 * We only promote items the user has already authored.
 */

import type { ResumeProfile, ResumeProject } from "@/lib/resume/types";

// Stopwords + tokenizer mirror the recommend-existing route's tokenizer so
// JD keyword extraction is consistent across the app. Kept inline (not
// imported) because that file's helpers are private; sharing later if a
// third caller needs them.
const STOPWORDS = new Set<string>([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at",
  "be","because","been","before","being","below","between","both","but","by",
  "can","cannot","could","couldn't",
  "did","do","does","doing","down","during",
  "each","etc",
  "few","for","from","further",
  "had","has","have","having","he","her","here","hers","herself","him","himself","his","how",
  "i","if","in","into","is","it","its","itself",
  "let","me","more","most","my","myself",
  "no","nor","not","now",
  "of","off","on","once","only","or","other","ought","our","ours","ourselves","out","over","own",
  "same","she","should","so","some","such",
  "than","that","the","their","theirs","them","themselves","then","there","these","they","this","those","through","to","too",
  "under","until","up",
  "very",
  "was","we","were","what","when","where","which","while","who","whom","why","will","with","within","without","would",
  "yes","you","your","yours","yourself","yourselves",
  "experience","work","working","role","team","skills","ability","strong","excellent","good","great","required","preferred",
  "looking","seeking","candidate","position","opportunity","company","years","year","minimum","plus","including",
  "responsibilities","requirements","qualifications","duties",
]);

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Tokenize a string into keywords. Keeps tech-relevant characters (+ # . / -)
 * so things like "C++", "C#", "Node.js", "CI/CD" survive intact.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#./-]+/)
      .filter((t) => t.length >= 2 && t.length <= 40)
      .filter((t) => !STOPWORDS.has(t))
      .filter((t) => !/^\d+$/.test(t)),
  );
}

/**
 * Extract multi-word capitalized phrases ("Machine Learning", "Apache Kafka").
 * These often carry more signal than single tokens.
 */
function extractPhrases(jd: string): Set<string> {
  const phrases = new Set<string>();
  const wordRe = /[A-Z][a-zA-Z0-9.+#-]*(?:\s+[A-Z][a-zA-Z0-9.+#-]*){1,2}/g;
  const matches = jd.match(wordRe) ?? [];
  for (const m of matches) {
    const lower = m.toLowerCase().trim();
    if (lower.length >= 5 && lower.length <= 40) phrases.add(lower);
  }
  return phrases;
}

/**
 * All keywords worth covering, ranked by priority:
 *   - phrases first (multi-word, higher specificity)
 *   - single tokens after
 */
export function extractJdKeywords(jdText: string): string[] {
  if (!jdText.trim()) return [];
  const tokens = tokenize(jdText);
  const phrases = extractPhrases(jdText);
  // Drop single tokens that are wholly contained in a phrase to avoid
  // double-counting "react" when "React Native" is already on the list.
  const phraseTokens = new Set<string>();
  phrases.forEach((p) => p.split(/\s+/).forEach((t) => phraseTokens.add(t)));
  const dedupedTokens = Array.from(tokens).filter((t) => !phraseTokens.has(t));
  return [...Array.from(phrases), ...dedupedTokens];
}

/**
 * Does any of the search-haystacks contain the keyword? Case-insensitive
 * substring match — covers `WebRTC` vs `webrtc` vs `Web RTC` (where the
 * tokenizer already collapsed whitespace).
 */
function profileTextContains(haystacks: string[], keyword: string): boolean {
  const k = normalize(keyword);
  if (!k) return false;
  return haystacks.some((h) => h.toLowerCase().includes(k));
}

/**
 * All places in the profile we look for a keyword. Skills + experience bullets
 * + project bullets + project stack + summaries + education details.
 */
function buildSearchIndex(profile: ResumeProfile): {
  skillTexts: Map<string, string>;
  projectTexts: Map<string, string>;
  experienceTexts: Map<string, string>;
  summaryTexts: Map<string, string>;
} {
  const skillTexts = new Map<string, string>();
  for (const s of profile.skills) skillTexts.set(s, s);

  const projectTexts = new Map<string, string>();
  for (const p of profile.projects) {
    if (!p.id) continue;
    projectTexts.set(
      p.id,
      [p.title, p.role ?? "", p.oneLiner, ...(p.bullets ?? []), ...(p.stack ?? [])].join(" \n "),
    );
  }

  const experienceTexts = new Map<string, string>();
  for (const e of profile.experiences) {
    if (!e.id) continue;
    experienceTexts.set(
      e.id,
      [e.company, e.title, ...(e.bullets ?? [])].join(" \n "),
    );
  }

  const summaryTexts = new Map<string, string>();
  for (const s of profile.summaries) {
    if (!s.id) continue;
    summaryTexts.set(s.id, [s.label, s.content].join(" \n "));
  }

  return { skillTexts, projectTexts, experienceTexts, summaryTexts };
}

export type CoverageState = "covered" | "in-profile" | "missing";

export interface KeywordCoverageEntry {
  keyword: string;
  state: CoverageState;
  /** Project ids in profile that contain the keyword (any state). */
  projectIds: string[];
  /** Skills in profile that match the keyword (substring). */
  skills: string[];
  /** Experience ids in profile that contain the keyword (informational). */
  experienceIds: string[];
}

export interface KeywordCoverageReport {
  /** Keywords the LLM-selected output already covers. */
  covered: string[];
  /** Keywords the user has but won't render unless we force-include. */
  inProfileNotPicked: string[];
  /** Keywords the user doesn't have anywhere. The audit will not invent these. */
  missing: string[];
  /** Detailed per-keyword view for the UI. */
  entries: KeywordCoverageEntry[];
  /** Project ids the caller MUST prepend to the selection. */
  mustIncludeProjectIds: string[];
  /** Skills the caller MUST keep in the skills list (even if dropped by LLM). */
  mustIncludeSkills: string[];
  /** Coverage ratio 0..1 = covered / (covered + inProfileNotPicked + missing). */
  coverageRatio: number;
}

export interface CoverageInput {
  profile: ResumeProfile;
  jdText: string;
  /** What the LLM currently selected — projects that will render. */
  selectedProjectIds: string[];
  /** What the LLM currently selected — skills that will render. */
  selectedSkills: string[];
  /** Cap how many keywords drive force-inclusion to avoid blowing up the resume. */
  maxKeywords?: number;
}

const DEFAULT_MAX_KEYWORDS = 25;

export function computeKeywordCoverage(input: CoverageInput): KeywordCoverageReport {
  const {
    profile,
    jdText,
    selectedProjectIds,
    selectedSkills,
    maxKeywords = DEFAULT_MAX_KEYWORDS,
  } = input;

  const keywords = extractJdKeywords(jdText).slice(0, maxKeywords);
  const { skillTexts, projectTexts, experienceTexts, summaryTexts } = buildSearchIndex(profile);

  const selectedProjectSet = new Set(selectedProjectIds);
  const selectedSkillSetLower = new Set(selectedSkills.map(normalize));

  const entries: KeywordCoverageEntry[] = [];
  const covered: string[] = [];
  const inProfileNotPicked: string[] = [];
  const missing: string[] = [];
  const mustIncludeProjectIdSet = new Set<string>();
  const mustIncludeSkillSet = new Set<string>();

  for (const kw of keywords) {
    const matchingProjectIds: string[] = [];
    projectTexts.forEach((text, pid) => {
      if (profileTextContains([text], kw)) matchingProjectIds.push(pid);
    });
    const matchingSkills: string[] = [];
    skillTexts.forEach((text, sk) => {
      if (profileTextContains([text], kw)) matchingSkills.push(sk);
    });
    const matchingExperienceIds: string[] = [];
    experienceTexts.forEach((text, eid) => {
      if (profileTextContains([text], kw)) matchingExperienceIds.push(eid);
    });
    let matchingSummaryHit = false;
    Array.from(summaryTexts.values()).some((text) => {
      if (profileTextContains([text], kw)) {
        matchingSummaryHit = true;
        return true;
      }
      return false;
    });

    const inProfile =
      matchingProjectIds.length > 0 ||
      matchingSkills.length > 0 ||
      matchingExperienceIds.length > 0 ||
      matchingSummaryHit;

    if (!inProfile) {
      missing.push(kw);
      entries.push({ keyword: kw, state: "missing", projectIds: [], skills: [], experienceIds: [] });
      continue;
    }

    // Already covered? — keyword either appears via a selected project,
    // a selected skill, or via a selected experience (we don't trim experiences).
    const coveredViaProject = matchingProjectIds.some((pid) => selectedProjectSet.has(pid));
    const coveredViaSkill = matchingSkills.some((s) => selectedSkillSetLower.has(normalize(s)));
    const coveredViaExperience = matchingExperienceIds.length > 0; // experiences always render
    const coveredViaSummary = matchingSummaryHit; // summary always renders if selected

    if (coveredViaProject || coveredViaSkill || coveredViaExperience || coveredViaSummary) {
      covered.push(kw);
      entries.push({
        keyword: kw,
        state: "covered",
        projectIds: matchingProjectIds,
        skills: matchingSkills,
        experienceIds: matchingExperienceIds,
      });
      continue;
    }

    // The keyword is in profile but won't render — promote it.
    inProfileNotPicked.push(kw);
    entries.push({
      keyword: kw,
      state: "in-profile",
      projectIds: matchingProjectIds,
      skills: matchingSkills,
      experienceIds: matchingExperienceIds,
    });

    // Pick the smallest viable promotion: prefer a skill (1 token) over a
    // project (multiple lines, eats page budget). If only projects match,
    // promote the first one.
    if (matchingSkills.length > 0) {
      mustIncludeSkillSet.add(matchingSkills[0]);
    } else if (matchingProjectIds.length > 0) {
      mustIncludeProjectIdSet.add(matchingProjectIds[0]);
    }
  }

  const total = covered.length + inProfileNotPicked.length + missing.length;
  const coverageRatio = total === 0 ? 1 : covered.length / total;

  return {
    covered,
    inProfileNotPicked,
    missing,
    entries,
    mustIncludeProjectIds: Array.from(mustIncludeProjectIdSet),
    mustIncludeSkills: Array.from(mustIncludeSkillSet),
    coverageRatio,
  };
}

/**
 * After computing coverage, project the must-include items back into the
 * caller's ordering. Force-included projects are prepended to the existing
 * selection (de-duped). Skills similarly. Bounded so we don't blow past the
 * template's page cap — caller still decides whether to bump page-target.
 */
export function applyCoverageToRanking(
  currentProjectIds: string[],
  currentSkills: string[],
  coverage: KeywordCoverageReport,
  caps: { maxProjects: number; maxSkills: number },
): { projectIds: string[]; skills: string[]; forcedProjects: string[]; forcedSkills: string[] } {
  const forcedProjects: string[] = [];
  const forcedSkills: string[] = [];

  const seenProjects = new Set(currentProjectIds);
  const newProjectIds = [...currentProjectIds];
  for (const id of coverage.mustIncludeProjectIds) {
    if (seenProjects.has(id)) continue;
    newProjectIds.unshift(id);
    seenProjects.add(id);
    forcedProjects.push(id);
  }
  const cappedProjects = newProjectIds.slice(0, caps.maxProjects);

  const seenSkills = new Set(currentSkills.map(normalize));
  const newSkills = [...currentSkills];
  for (const sk of coverage.mustIncludeSkills) {
    if (seenSkills.has(normalize(sk))) continue;
    newSkills.unshift(sk);
    seenSkills.add(normalize(sk));
    forcedSkills.push(sk);
  }
  const cappedSkills = newSkills.slice(0, caps.maxSkills);

  return {
    projectIds: cappedProjects,
    skills: cappedSkills,
    forcedProjects,
    forcedSkills,
  };
}

/**
 * Convenience: did force-inclusion drop something we wanted? Helps the caller
 * decide whether to bump pageTarget from 1 → 2 to keep the keyword.
 */
export function detectCappedOut(
  desired: string[],
  applied: string[],
  forced: string[],
): string[] {
  if (forced.length === 0) return [];
  const appliedSet = new Set(applied);
  return forced.filter((id) => !appliedSet.has(id));
}

// Re-exported only for tests / debug — keep the surface area small.
export const __internal = { tokenize, extractPhrases, profileTextContains };
export type { ResumeProject };
