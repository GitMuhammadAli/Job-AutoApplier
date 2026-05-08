import { prisma } from "@/lib/prisma";
import { keywordMatchesText, parseSalaryRange } from "@/lib/matching/score-engine";

interface FeatureVector {
  keywordOverlap: number;
  titleRelevance: number;
  salaryFit: number;
  locationMatch: number;
  experienceFit: number;
}

interface ScorerWeights {
  keywordOverlap: number;
  titleRelevance: number;
  salaryFit: number;
  locationMatch: number;
  experienceFit: number;
  bias: number;
}

const DEFAULT_WEIGHTS: ScorerWeights = {
  keywordOverlap: 2.0,
  titleRelevance: 1.5,
  salaryFit: 1.0,
  locationMatch: 0.8,
  experienceFit: 0.7,
  bias: -1.5,
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function extractFeatures(
  jobSkills: string[],
  userSkills: string[],
  jobTitle: string,
  targetRole: string,
  jobLocation: string,
  userLocation: string,
  jobSeniority: string,
  userLevel: string,
  jobSalary?: string | null,
  userSalaryMin?: number | null,
  userSalaryMax?: number | null,
): FeatureVector {
  // Symmetric overlap using max-denominator. The original `matching / jobLower.length`
  // was asymmetric: a JD listing 1 skill the user has scored 1.0, while a JD
  // listing 10 skills with 5 user-matched scored 0.5 — junior-friendly sparse
  // JDs ranked impossibly high. Use Math.max so both sides matter.
  // Variant-aware via keywordMatchesText so node.js↔nodejs, full stack↔fullstack
  // match — the strict Array.includes was missing all of these.
  const userLower = Array.from(new Set(userSkills.map(s => s.toLowerCase().trim()).filter(Boolean)));
  const jobLower = Array.from(new Set(jobSkills.map(s => s.toLowerCase().trim()).filter(Boolean)));
  const jobSkillsBlob = jobLower.join(" ");
  const matching = userLower.filter(s => keywordMatchesText(s, jobSkillsBlob)).length;
  const denom = Math.max(jobLower.length, userLower.length);
  const keywordOverlap = denom > 0 ? matching / denom : 0;

  // Title relevance also via keywordMatchesText so "Full Stack Developer"
  // matches "Fullstack Engineer" via variant table.
  const titleLower = jobTitle.toLowerCase();
  const roleWords = Array.from(
    new Set(
      targetRole.toLowerCase().split(/\s+/).filter((w) => w.length > 1),
    ),
  );
  const titleMatching = roleWords.filter((w) => keywordMatchesText(w, titleLower)).length;
  const titleRelevance = roleWords.length > 0 ? titleMatching / roleWords.length : 0.5;

  // Real salary fit. Was hardcoded 0.5, making the feature constant
  // (zero variance → SGD weight had no signal to learn from). Now:
  //   1.0 if user's range fits inside job's range (best)
  //   partial overlap → fraction of overlap vs union
  //   0.3 if no salary data on either side (neutral, beats "0 = bad")
  let salaryFit = 0.3;
  if (jobSalary) {
    const range = parseSalaryRange(jobSalary);
    if (range) {
      const userMin = userSalaryMin ?? 0;
      const userMax = userSalaryMax ?? Number.MAX_SAFE_INTEGER;
      const overlapMin = Math.max(range.min, userMin);
      const overlapMax = Math.min(range.max, userMax);
      if (overlapMax >= overlapMin) {
        const overlap = overlapMax - overlapMin;
        const span = Math.max(range.max, userMax) - Math.min(range.min, userMin);
        salaryFit = span > 0 ? Math.min(1, overlap / span + 0.5) : 0.7;
      } else {
        salaryFit = 0.1; // ranges disjoint
      }
    }
  }

  const jobLocLower = jobLocation.toLowerCase();
  const isRemote = jobLocLower.includes("remote");
  const sameLocation = userLocation && jobLocLower.includes(userLocation.toLowerCase());
  const locationMatch = isRemote ? 1.0 : sameLocation ? 0.8 : 0.2;

  const seniorityMap: Record<string, number> = { intern: 0, junior: 1, mid: 2, senior: 3, lead: 4, principal: 5 };
  const jobLevel = seniorityMap[jobSeniority?.toLowerCase()] ?? 2;
  const uLevel = seniorityMap[userLevel?.toLowerCase()] ?? 1;
  const experienceFit = 1 - Math.min(Math.abs(jobLevel - uLevel) / 3, 1);

  return { keywordOverlap, titleRelevance, salaryFit, locationMatch, experienceFit };
}

export function scoreJob(features: FeatureVector, weights: ScorerWeights = DEFAULT_WEIGHTS): number {
  const logit =
    weights.keywordOverlap * features.keywordOverlap +
    weights.titleRelevance * features.titleRelevance +
    weights.salaryFit * features.salaryFit +
    weights.locationMatch * features.locationMatch +
    weights.experienceFit * features.experienceFit +
    weights.bias;
  return Math.round(sigmoid(logit) * 100);
}

export async function trainFromUserBehavior(userId: string): Promise<ScorerWeights> {
  const userJobs = await prisma.userJob.findMany({
    where: { userId, stage: { in: ["SAVED", "APPLIED", "INTERVIEW", "REJECTED"] } },
    include: { globalJob: true },
  });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings || userJobs.length < 10) return DEFAULT_WEIGHTS;

  const userSkills = settings.keywords ?? [];
  const targetRole = settings.keywords?.[0] ?? "";
  const userLocation = [settings.city, settings.country].filter(Boolean).join(", ");
  const userLevel = settings.experienceLevel ?? "junior";

  const trainingData = userJobs.map(uj => {
    const features = extractFeatures(
      (uj.globalJob.skills as string[]) ?? [],
      userSkills,
      uj.globalJob.title,
      targetRole,
      uj.globalJob.location ?? "",
      userLocation,
      uj.globalJob.experienceLevel ?? "",
      userLevel,
      uj.globalJob.salary,
      settings.salaryMin,
      settings.salaryMax,
    );
    const label = ["SAVED", "APPLIED", "INTERVIEW"].includes(uj.stage) ? 1 : 0;
    return { features, label };
  });

  const weights = { ...DEFAULT_WEIGHTS };
  const lr = 0.1;
  const keys: (keyof FeatureVector)[] = ["keywordOverlap", "titleRelevance", "salaryFit", "locationMatch", "experienceFit"];

  for (let iter = 0; iter < 20; iter++) {
    for (const { features, label } of trainingData) {
      const prediction = sigmoid(keys.reduce((sum, k) => sum + weights[k] * features[k], 0) + weights.bias);
      const error = prediction - label;
      for (const k of keys) weights[k] -= lr * error * features[k];
      weights.bias -= lr * error;
    }
  }

  return weights;
}
