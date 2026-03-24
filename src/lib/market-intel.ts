// C4: Fetch trending skill data from DevRadar to boost job matching scores

interface TrendingSkill {
  skill: string;
  jobCount: number;
  changeRate: number;
}

let cache: { data: TrendingSkill[]; fetchedAt: number } | null = null;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

export async function getTrendingSkills(): Promise<TrendingSkill[]> {
  // Return cached if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  const devradarUrl = process.env.NEXT_PUBLIC_DEVRADAR_URL;
  if (!devradarUrl) return [];

  try {
    const res = await fetch(`${devradarUrl}/api/v1/skills?limit=30`, {
      next: { revalidate: 86400 }, // Cache for 1 day in Next.js
    });

    if (!res.ok) return cache?.data ?? [];

    const json = await res.json();
    const data: TrendingSkill[] = (json.data ?? json ?? []).map((s: any) => ({
      skill: (s.skill ?? s.name ?? "").toLowerCase(),
      jobCount: s.jobCount ?? s.count ?? 0,
      changeRate: s.changeRate ?? 0,
    }));

    cache = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    return cache?.data ?? [];
  }
}

// Calculate trending boost for a job's skills
export async function getTrendingBoost(jobSkills: string[]): Promise<number> {
  const trending = await getTrendingSkills();
  if (trending.length === 0 || jobSkills.length === 0) return 0;

  const trendingNames = new Set(trending.map(t => t.skill));
  const risingNames = new Set(
    trending.filter(t => t.changeRate > 10).map(t => t.skill)
  );

  const jobLower = jobSkills.map(s => s.toLowerCase());
  const matchCount = jobLower.filter(s => trendingNames.has(s)).length;
  const risingCount = jobLower.filter(s => risingNames.has(s)).length;

  // 0-15 point boost: 10 for trending match ratio + 5 for rising skills
  const trendingBoost = (matchCount / jobLower.length) * 10;
  const risingBoost = risingCount > 0 ? 5 : 0;

  return Math.round(trendingBoost + risingBoost);
}
