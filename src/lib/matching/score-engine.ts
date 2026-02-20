/**
 * Computes a 0-100 match score between a GlobalJob and a user's settings/resumes.
 * Returns the score + an array of human-readable match reasons.
 */

export const MATCH_THRESHOLDS = {
  SHOW_ON_KANBAN: 30,
  AUTO_DRAFT: 50,
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

export function computeMatchScore(
  job: GlobalJobLike,
  settings: UserSettingsLike,
  resumes: Array<ResumeLike & { id: string }>
): MatchResult {
  const reasons: string[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  const titleLower = job.title.toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const locationLower = (job.location || "").toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // ── Keyword matching (weight: 35) ──
  const keywordWeight = 35;
  totalWeight += keywordWeight;
  if (settings.keywords.length > 0) {
    const matched = settings.keywords.filter((kw) => {
      const kwLower = kw.toLowerCase();
      return titleLower.includes(kwLower) || descLower.includes(kwLower);
    });
    const ratio = matched.length / settings.keywords.length;
    const earned = Math.round(keywordWeight * ratio);
    earnedWeight += earned;
    if (matched.length > 0) {
      reasons.push(`Keywords: ${matched.slice(0, 5).join(", ")}`);
    }
  }

  // ── Location matching (weight: 25) ──
  const locationWeight = 25;
  totalWeight += locationWeight;
  let locationMismatch = false;
  if (settings.city || settings.country) {
    const cityLower = settings.city?.toLowerCase() ?? "";
    const countryLower = settings.country?.toLowerCase() ?? "";
    const cityMatch = cityLower && locationLower.includes(cityLower);
    const countryMatch = countryLower && locationLower.includes(countryLower);
    const remoteMatch =
      (locationLower.includes("remote") || locationLower.includes("anywhere") || locationLower.includes("worldwide")) &&
      settings.workType.includes("remote");

    if (cityMatch) {
      earnedWeight += locationWeight;
      reasons.push(`Location: ${settings.city}`);
    } else if (remoteMatch) {
      earnedWeight += locationWeight;
      reasons.push("Remote work match");
    } else if (countryMatch) {
      earnedWeight += Math.round(locationWeight * 0.7);
      reasons.push(`Country: ${settings.country}`);
    } else if (locationLower && locationLower !== "n/a" && locationLower !== "not specified") {
      locationMismatch = true;
    }
  } else {
    earnedWeight += Math.round(locationWeight * 0.5);
  }

  // ── Category matching (weight: 15) ──
  const categoryWeight = 15;
  totalWeight += categoryWeight;
  if (settings.preferredCategories.length > 0) {
    if (job.category && settings.preferredCategories.some(
      (c) => c.toLowerCase() === job.category!.toLowerCase()
    )) {
      earnedWeight += categoryWeight;
      reasons.push(`Category: ${job.category}`);
    } else {
      const catKeywords = settings.preferredCategories.flatMap((c) =>
        c.toLowerCase().split(/[\s/]+/)
      );
      const catMatch = catKeywords.some((ck) => combined.includes(ck));
      if (catMatch) {
        earnedWeight += Math.round(categoryWeight * 0.6);
        reasons.push("Category keywords found in description");
      }
    }
  } else {
    earnedWeight += Math.round(categoryWeight * 0.5);
  }

  // ── Skills matching from resume (weight: 15) ──
  const skillsWeight = 15;
  totalWeight += skillsWeight;
  let bestResumeId: string | null = null;
  let bestResumeName: string | null = null;
  let bestResumeScore = 0;

  for (const resume of resumes) {
    if (!resume.content) continue;
    const resumeLower = resume.content.toLowerCase();
    const resumeWords = new Set(resumeLower.split(/[\s,;|]+/).filter((w) => w.length > 2));

    let matchCount = 0;
    const jobSkills = job.skills.length > 0
      ? job.skills
      : extractKeywordsFromText(combined);

    for (const skill of jobSkills) {
      if (resumeLower.includes(skill.toLowerCase())) matchCount++;
    }

    // Also check if resume words appear in job
    const resumeKeywords = Array.from(resumeWords).filter((w) => w.length > 3);
    let resumeHits = 0;
    for (const rk of resumeKeywords.slice(0, 50)) {
      if (combined.includes(rk)) resumeHits++;
    }

    const score = jobSkills.length > 0
      ? (matchCount / jobSkills.length) * 0.7 + Math.min(resumeHits / 20, 1) * 0.3
      : Math.min(resumeHits / 15, 1);

    if (score > bestResumeScore) {
      bestResumeScore = score;
      bestResumeId = resume.id;
      bestResumeName = resume.name;
    }
  }

  if (bestResumeScore > 0) {
    earnedWeight += Math.round(skillsWeight * bestResumeScore);
    if (bestResumeName) {
      reasons.push(`Best resume: ${bestResumeName}`);
    }
  }

  // ── Experience level match (weight: 10) ──
  const expWeight = 10;
  totalWeight += expWeight;
  if (settings.experienceLevel && job.experienceLevel) {
    if (job.experienceLevel.toLowerCase().includes(settings.experienceLevel.toLowerCase())) {
      earnedWeight += expWeight;
      reasons.push(`Experience: ${job.experienceLevel}`);
    }
  } else if (!settings.experienceLevel) {
    earnedWeight += Math.round(expWeight * 0.5);
  }

  // ── Job type match (weight: 5) ──
  const typeWeight = 5;
  totalWeight += typeWeight;
  if (settings.jobType.length > 0 && job.jobType) {
    if (settings.jobType.some((t) => job.jobType!.toLowerCase().includes(t.toLowerCase()))) {
      earnedWeight += typeWeight;
      reasons.push(`Job type: ${job.jobType}`);
    }
  } else {
    earnedWeight += Math.round(typeWeight * 0.5);
  }

  let score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 50;

  // Location mismatch penalty: if user set a location and job is clearly elsewhere,
  // subtract 20 points so irrelevant regions don't clutter the Kanban
  if (locationMismatch) {
    score = Math.max(score - 20, 0);
    reasons.push("Location mismatch (−20)");
  }

  // Freshness bonus based on when the job was first seen
  if (job.firstSeenAt) {
    const daysSinceFound = (Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceFound < 1) {
      score = Math.min(score + 5, 100);
      reasons.push("Freshness: Posted today (+5)");
    } else if (daysSinceFound < 3) {
      score = Math.min(score + 3, 100);
      reasons.push("Freshness: Posted recently (+3)");
    }
  } else if (job.isFresh) {
    score = Math.min(score + 5, 100);
    reasons.push("Fresh posting bonus");
  }

  return {
    score: Math.min(score, 100),
    reasons,
    bestResumeId,
    bestResumeName,
  };
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
