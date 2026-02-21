/**
 * Shared location filter: only show jobs that match the user's city/country from settings.
 * Used by getJobs (dashboard/Kanban), recommended page, and anywhere we list user jobs.
 */

function isRemoteLocation(location: string | null): boolean {
  if (!location?.trim()) return false;
  const loc = location.toLowerCase();
  return (
    loc.includes("remote") ||
    loc.includes("anywhere") ||
    loc.includes("worldwide") ||
    loc.includes("global")
  );
}

/**
 * Returns true if the job should be shown given user's preferred platforms (source).
 * When preferredPlatforms is set, only jobs from those sources are shown.
 */
export function jobMatchesPlatformPreferences(
  jobSource: string | null | undefined,
  preferredPlatforms: string[] | null | undefined
): boolean {
  const platforms = (preferredPlatforms ?? []).map((p) => (p || "").toLowerCase().trim()).filter(Boolean);
  if (platforms.length === 0) return true;
  const sourceLower = (jobSource ?? "").toLowerCase().trim();
  if (!sourceLower) return true;
  return platforms.includes(sourceLower);
}

/**
 * Returns true if the job should be shown given user's city/country preferences.
 * - If city is set (e.g. Lahore): show only jobs in that city or remote. Never other cities (e.g. Karachi).
 * - If only country is set: show only jobs in that country or remote.
 * - If neither: show all (no location filter).
 */
export function jobMatchesLocationPreferences(
  jobLocation: string | null,
  city: string | null | undefined,
  country: string | null | undefined
): boolean {
  const cityTrimmed = city?.trim();
  const countryTrimmed = country?.trim();

  if (cityTrimmed) {
    if (!jobLocation?.trim()) return true;
    if (isRemoteLocation(jobLocation)) return true;
    const loc = jobLocation.toLowerCase();
    const cityLower = cityTrimmed.toLowerCase().split(",")[0]?.trim() ?? "";
    if (!cityLower) return true;
    return loc.includes(cityLower);
  }

  if (countryTrimmed) {
    if (!jobLocation?.trim()) return true;
    if (isRemoteLocation(jobLocation)) return true;
    const loc = jobLocation.toLowerCase();
    const countryLower = countryTrimmed.toLowerCase();
    return loc.includes(countryLower);
  }

  return true;
}

/** Normalize for dedupe key: trim, lower case, treat empty as "" */
function jobKey(title: string | null, company: string | null, location: string | null): string {
  const t = (title ?? "").trim().toLowerCase();
  const c = (company ?? "").trim().toLowerCase();
  const l = (location ?? "").trim().toLowerCase();
  return `${t}|${c}|${l}`;
}

/**
 * Deduplicate user jobs so the same logical job (title + company + location) appears only once.
 * Keeps the row with highest matchScore; if tied, most recent createdAt.
 * Use after location filter when displaying lists (dashboard, recommended).
 */
export function deduplicateUserJobsByLogicalJob<T extends {
  globalJob: { title: string | null; company: string | null; location: string | null };
  matchScore: number | null;
  createdAt: Date | string;
}>(jobs: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const j of jobs) {
    const key = jobKey(j.globalJob.title, j.globalJob.company, j.globalJob.location);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, j);
      continue;
    }
    const scoreA = existing.matchScore ?? 0;
    const scoreB = j.matchScore ?? 0;
    if (scoreB > scoreA) {
      byKey.set(key, j);
    } else if (scoreB === scoreA) {
      const timeA = new Date(existing.createdAt).getTime();
      const timeB = new Date(j.createdAt).getTime();
      if (timeB > timeA) byKey.set(key, j);
    }
  }
  const out = Array.from(byKey.values());
  out.sort((a, b) => {
    const sa = a.matchScore ?? 0;
    const sb = b.matchScore ?? 0;
    if (sb !== sa) return sb - sa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return out;
}
