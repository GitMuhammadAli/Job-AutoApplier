/**
 * Computes a 0-100 match score between a GlobalJob and a user's settings/resumes.
 * Uses HARD FILTERS first (keyword, platform, category, location) to reject irrelevant jobs,
 * then scores remaining jobs on 7 weighted factors.
 */

export const MATCH_THRESHOLDS = {
  SHOW_ON_KANBAN: 40,
  NOTIFY: 50,
  AUTO_DRAFT: 55,
  AUTO_SEND: 65,
} as const;

interface GlobalJobLike {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  category: string | null;
  skills: string[];
  source?: string;
  isFresh?: boolean;
  firstSeenAt?: Date | null;
}

interface UserSettingsLike {
  keywords: string[];
  city: string | null;
  country: string | null;
  experienceLevel: string | null;
  workType: string[];
  jobType: string[];
  preferredCategories: string[];
  preferredPlatforms: string[];
  salaryMin: number | null;
  salaryMax: number | null;
}

interface ResumeLike {
  content: string | null;
  name: string;
}

interface MatchResult {
  score: number;
  reasons: string[];
  bestResumeId: string | null;
  bestResumeName: string | null;
}

const REJECT: MatchResult = { score: 0, reasons: [], bestResumeId: null, bestResumeName: null };

// Words too generic to use for fuzzy category matching
const CATEGORY_STOP_WORDS = new Set([
  "development", "engineering", "management", "design", "systems",
  "science", "writing", "relations", "administration", "programming",
  "testing", "automation", "advocacy", "mobile", "cloud", "data",
  "network", "product", "technical", "cross", "platform", "web",
  "general", "other", "misc", "specialist", "senior", "junior",
  "lead", "head", "chief", "manager", "director", "officer",
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks if a keyword appears as a whole word/phrase in text.
 * Prevents "css" from matching "accessing" or "vite" matching "invite".
 */
function keywordMatchesText(keyword: string, text: string): boolean {
  if (keyword.length <= 1) return false;
  const escaped = escapeRegex(keyword);
  // For short keywords (2-3 chars like "go", "r", "css"), require strict word boundaries
  // For longer keywords, use looser boundaries that work with dots/hyphens
  const pattern = keyword.length <= 3
    ? new RegExp(`(?:^|[\\s,;|/()\\[\\]:\\-])${escaped}(?:[\\s,;|/()\\[\\]:\\-.]|$)`, "i")
    : new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i");
  return pattern.test(text);
}

export function computeMatchScore(
  job: GlobalJobLike,
  settings: UserSettingsLike,
  resumes: Array<ResumeLike & { id: string }>
): MatchResult {
  const reasons: string[] = [];
  const titleLower = job.title.toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const locationLower = (job.location || "").toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // ════════════════════════════════════════════
  // HARD FILTER 1: Platform
  // ════════════════════════════════════════════
  if (
    settings.preferredPlatforms.length > 0 &&
    job.source &&
    !settings.preferredPlatforms.includes(job.source)
  ) {
    return { ...REJECT, reasons: ["Platform not selected"] };
  }

  // ════════════════════════════════════════════
  // HARD FILTER 2: At least 1 keyword MUST match as a whole word
  // ════════════════════════════════════════════
  const userKeywords = settings.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  const matchedKeywords = userKeywords.filter(
    (kw) => keywordMatchesText(kw, titleLower) || keywordMatchesText(kw, descLower)
  );
  const titleKeywords = userKeywords.filter((kw) => keywordMatchesText(kw, titleLower));

  if (userKeywords.length > 0 && matchedKeywords.length === 0) {
    return { ...REJECT, reasons: ["No keyword match"] };
  }

  // ════════════════════════════════════════════
  // HARD FILTER 3: Category
  // ════════════════════════════════════════════
  if (settings.preferredCategories.length > 0) {
    const userCats = settings.preferredCategories.map((c) => c.toLowerCase());
    const jobCat = (job.category || "").toLowerCase();

    const directCatMatch = jobCat && userCats.some(
      (c) => c === jobCat || jobCat.includes(c) || c.includes(jobCat)
    );

    if (!directCatMatch) {
      // Only do fuzzy match if user selected fewer than 15 categories
      // (selecting everything means category filter adds no value)
      if (settings.preferredCategories.length < 15) {
        const catKeywords = userCats.flatMap((c) =>
          c.split(/[\s/]+/).filter((w) => w.length > 3 && !CATEGORY_STOP_WORDS.has(w))
        );
        const fuzzyCatMatch = catKeywords.some((ck) => keywordMatchesText(ck, combined));
        if (!fuzzyCatMatch) {
          return { ...REJECT, reasons: ["Category mismatch"] };
        }
      }
      // When 15+ categories selected, skip fuzzy — rely on keyword filter
    }
  }

  // ════════════════════════════════════════════
  // HARD FILTER 4: Location — reject non-remote jobs from different countries
  // ════════════════════════════════════════════
  if (settings.country && locationLower) {
    const countryLower = settings.country.toLowerCase();
    const isRemote =
      locationLower.includes("remote") ||
      locationLower.includes("anywhere") ||
      locationLower.includes("worldwide") ||
      locationLower.includes("global");
    const isInCountry = locationLower.includes(countryLower);

    // Known country names to check for foreign locations
    const knownCountries = [
      "india", "usa", "united states", "uk", "united kingdom", "germany",
      "canada", "australia", "france", "spain", "brazil", "china",
      "japan", "singapore", "netherlands", "ireland", "sweden", "switzerland",
      "israel", "uae", "dubai", "saudi", "qatar", "nigeria", "kenya",
      "south africa", "egypt", "turkey", "mexico", "argentina", "chile",
      "colombia", "indonesia", "philippines", "vietnam", "thailand", "malaysia",
    ];

    const locationMentionsForeignCountry = knownCountries.some(
      (c) => c !== countryLower && locationLower.includes(c)
    );

    if (!isRemote && !isInCountry && locationMentionsForeignCountry) {
      return { ...REJECT, reasons: ["Wrong country"] };
    }
  }

  // ════════════════════════════════════════════
  // SCORING — Only jobs that passed all hard filters get scored
  // ════════════════════════════════════════════
  let score = 0;

  // Factor 1: KEYWORD MATCH (0-30 points)
  // Specificity penalty: too many keywords dilute match quality
  if (matchedKeywords.length > 0) {
    const keywordRatio = matchedKeywords.length / userKeywords.length;
    let keywordScore = Math.round(keywordRatio * 30);
    if (userKeywords.length > 10) {
      const penaltyFactor = Math.max(0.7, 1 - (userKeywords.length - 10) * 0.03);
      keywordScore = Math.round(keywordScore * penaltyFactor);
    }
    score += keywordScore;
    reasons.push(`Keywords: ${matchedKeywords.slice(0, 5).join(", ")} (${matchedKeywords.length}/${userKeywords.length})`);
  }

  // Factor 2: TITLE RELEVANCE (0-20 points)
  if (titleKeywords.length > 0) {
    score += Math.min(20, titleKeywords.length * 10);
    reasons.push(`Title match: ${titleKeywords.slice(0, 3).join(", ")}`);
  }

  // Factor 3: SKILL MATCH from resume (0-20 points)
  let bestResumeId: string | null = null;
  let bestResumeName: string | null = null;
  let bestResumeScore = 0;

  for (const resume of resumes) {
    if (!resume.content) continue;
    const resumeLower = resume.content.toLowerCase();

    const jobSkills = job.skills.length > 0
      ? job.skills
      : extractKeywordsFromText(combined);

    let matchCount = 0;
    for (const skill of jobSkills) {
      if (resumeLower.includes(skill.toLowerCase())) matchCount++;
    }

    const resumeKeywords = new Set(
      resumeLower.split(/[\s,;|]+/).filter((w) => w.length > 3)
    );
    let resumeHits = 0;
    for (const rk of Array.from(resumeKeywords).slice(0, 50)) {
      if (combined.includes(rk)) resumeHits++;
    }

    const rScore = jobSkills.length > 0
      ? (matchCount / jobSkills.length) * 0.7 + Math.min(resumeHits / 20, 1) * 0.3
      : Math.min(resumeHits / 15, 1);

    if (rScore > bestResumeScore) {
      bestResumeScore = rScore;
      bestResumeId = resume.id;
      bestResumeName = resume.name;
    }
  }

  if (bestResumeScore > 0) {
    const skillPoints = Math.round(bestResumeScore * 20);
    score += skillPoints;
    if (bestResumeName) {
      reasons.push(`Skills via ${bestResumeName} (+${skillPoints})`);
    }
  }

  // Factor 4: CATEGORY MATCH (0-10 points)
  if (settings.preferredCategories.length > 0 && job.category) {
    const userCats = settings.preferredCategories.map((c) => c.toLowerCase());
    const jobCat = job.category.toLowerCase();
    if (userCats.some((c) => c === jobCat || jobCat.includes(c) || c.includes(jobCat))) {
      score += 10;
      reasons.push(`Category: ${job.category}`);
    } else {
      score += 3;
      reasons.push("Category: partial match");
    }
  }

  // Factor 5: LOCATION MATCH (0-10 points) / PENALTY
  if (settings.city || settings.country) {
    const cityLower = settings.city?.toLowerCase() ?? "";
    const countryLower = settings.country?.toLowerCase() ?? "";
    const cityMatch = cityLower && locationLower.includes(cityLower);
    const countryMatch = countryLower && locationLower.includes(countryLower);
    const remoteMatch =
      (locationLower.includes("remote") || locationLower.includes("anywhere") || locationLower.includes("worldwide")) &&
      settings.workType.includes("remote");

    if (cityMatch) {
      score += 10;
      reasons.push(`Location: ${settings.city}`);
    } else if (remoteMatch) {
      score += 5;
      reasons.push("Remote work match");
    } else if (countryMatch) {
      score += 7;
      reasons.push(`Country: ${settings.country}`);
    } else if (locationLower && locationLower !== "n/a" && locationLower !== "not specified") {
      score = Math.max(score - 15, 0);
      reasons.push("Location mismatch (\u221215)");
    }
  }

  // Factor 6: EXPERIENCE LEVEL MATCH (0-5 points)
  if (settings.experienceLevel) {
    const expLower = settings.experienceLevel.toLowerCase();
    const expKeywords: Record<string, string[]> = {
      entry: ["junior", "entry", "intern", "graduate", "fresh", "0-2"],
      mid: ["mid", "intermediate", "2-4", "3-5", "2+"],
      senior: ["senior", "lead", "principal", "staff", "5+", "7+", "8+"],
      lead: ["lead", "principal", "staff", "director", "head", "architect", "8+"],
    };
    const matchers = expKeywords[expLower] || [expLower];
    if (matchers.some((kw) => combined.includes(kw))) {
      score += 5;
      reasons.push(`Experience: ${settings.experienceLevel}`);
    }
  }

  // Factor 7: FRESHNESS BONUS (0-5 points) — only if job has title keyword match
  if (titleKeywords.length > 0) {
    if (job.firstSeenAt) {
      const daysSince = (Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 1) {
        score += 5;
        reasons.push("Freshness: Posted today (+5)");
      } else if (daysSince < 3) {
        score += 3;
        reasons.push("Freshness: Recent (+3)");
      } else if (daysSince < 7) {
        score += 1;
      }
    } else if (job.isFresh) {
      score += 5;
      reasons.push("Freshness: Posted today (+5)");
    }
  }

  score = Math.min(score, 100);

  return { score, reasons, bestResumeId, bestResumeName };
}

function extractKeywordsFromText(text: string): string[] {
  const techTerms = [
    "react", "vue", "angular", "next.js", "node.js", "express", "nestjs",
    "typescript", "javascript", "python", "java", "c#", "go", "rust", "ruby",
    "php", "swift", "kotlin", "flutter", "react native",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "graphql", "rest", "microservices", "ci/cd", "git",
    "tailwind", "sass", "html", "css", "figma",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "django", "flask", "spring", "laravel", ".net",
  ];
  return techTerms.filter((t) => text.includes(t));
}
