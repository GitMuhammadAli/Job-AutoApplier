import { prisma } from "@/lib/prisma";

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
): FeatureVector {
  const jobLower = jobSkills.map(s => s.toLowerCase());
  const userLower = userSkills.map(s => s.toLowerCase());

  const matching = userLower.filter(s => jobLower.includes(s)).length;
  const keywordOverlap = jobLower.length > 0 ? matching / jobLower.length : 0;

  const titleWords = jobTitle.toLowerCase().split(/\s+/);
  const roleWords = targetRole.toLowerCase().split(/\s+/);
  const titleMatching = roleWords.filter(w => titleWords.includes(w)).length;
  const titleRelevance = roleWords.length > 0 ? titleMatching / roleWords.length : 0.5;

  const salaryFit = 0.5; // Default — expand when salary data available

  const isRemote = jobLocation.toLowerCase().includes("remote");
  const sameLocation = jobLocation.toLowerCase().includes(userLocation.toLowerCase());
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
