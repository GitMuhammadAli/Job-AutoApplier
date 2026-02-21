/**
 * Shared location filter: only show jobs that match the user's city/country from settings.
 * Used by getJobs (dashboard/Kanban), recommended page, and anywhere we list user jobs.
 */

const REMOTE_INDICATORS = [
  "remote", "worldwide", "anywhere", "global", "work from home",
  "distributed", "wfh", "telecommute", "home-based", "home based",
];

const COUNTRY_CODE_MAP: Record<string, string> = {
  pk: "pakistan", pak: "pakistan",
  us: "united states", usa: "united states",
  uk: "united kingdom", gb: "united kingdom", gbr: "united kingdom",
  de: "germany", deu: "germany", in: "india", ind: "india",
  ca: "canada", can: "canada", au: "australia", aus: "australia",
  fr: "france", fra: "france", es: "spain", esp: "spain",
  br: "brazil", bra: "brazil", cn: "china", chn: "china",
  jp: "japan", jpn: "japan", sg: "singapore", sgp: "singapore",
  nl: "netherlands", nld: "netherlands", ie: "ireland", irl: "ireland",
  se: "sweden", swe: "sweden", ch: "switzerland", che: "switzerland",
  il: "israel", isr: "israel", ae: "uae", uae: "uae",
  ng: "nigeria", nga: "nigeria", ke: "kenya", ken: "kenya",
  za: "south africa", zaf: "south africa", eg: "egypt", egy: "egypt",
  tr: "turkey", tur: "turkey", mx: "mexico", mex: "mexico",
  ar: "argentina", arg: "argentina", cl: "chile", chl: "chile",
  co: "colombia", col: "colombia", id: "indonesia", idn: "indonesia",
  ph: "philippines", phl: "philippines", vn: "vietnam", vnm: "vietnam",
  th: "thailand", tha: "thailand", my: "malaysia", mys: "malaysia",
  bd: "bangladesh", bgd: "bangladesh", lk: "sri lanka", lka: "sri lanka",
  np: "nepal", npl: "nepal", sa: "saudi arabia", ksa: "saudi arabia",
  qa: "qatar", qat: "qatar", kw: "kuwait", kwt: "kuwait",
  ro: "romania", rou: "romania", pl: "poland", pol: "poland",
  cz: "czech republic", cze: "czech republic",
  at: "austria", aut: "austria", be: "belgium", bel: "belgium",
  dk: "denmark", dnk: "denmark", fi: "finland", fin: "finland",
  no: "norway", nor: "norway", pt: "portugal", prt: "portugal",
  it: "italy", ita: "italy", nz: "new zealand", nzl: "new zealand",
  ua: "ukraine", ukr: "ukraine", tw: "taiwan", twn: "taiwan",
  hk: "hong kong", hkg: "hong kong", kr: "south korea", kor: "south korea",
};

function isRemoteLocation(location: string | null): boolean {
  if (!location?.trim()) return false;
  const loc = location.toLowerCase();
  return REMOTE_INDICATORS.some((r) => loc.includes(r));
}

function matchesCountry(locationLower: string, countryLower: string): boolean {
  if (locationLower.includes(countryLower)) return true;
  const parts = locationLower.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? "";
  const resolved = COUNTRY_CODE_MAP[lastPart];
  return resolved === countryLower;
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
    if (loc.includes(cityLower)) return true;
    // Country-only location (e.g. "Pakistan") — allow when country matches
    if (countryTrimmed && matchesCountry(loc, countryTrimmed.toLowerCase())) return true;
    return false;
  }

  if (countryTrimmed) {
    if (!jobLocation?.trim()) return true;
    if (isRemoteLocation(jobLocation)) return true;
    const loc = jobLocation.toLowerCase();
    return matchesCountry(loc, countryTrimmed.toLowerCase());
  }

  return true;
}

/** Normalize for dedupe key: strip non-alphanumeric to match cross-source variants */
function normalizeForDedup(text: string | null): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|gmbh|co|company|pvt|private|limited|\.)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function jobKey(title: string | null, company: string | null, _location: string | null): string {
  return `${normalizeForDedup(title)}|${normalizeForDedup(company)}`;
}

/**
 * Build a Set of normalized title|company keys from existing UserJobs.
 * Use before creating a new UserJob to prevent cross-source duplicates.
 */
export function buildExistingJobKeys(
  existingJobs: Array<{ title: string | null; company: string | null }>
): Set<string> {
  const keys = new Set<string>();
  for (const j of existingJobs) {
    keys.add(jobKey(j.title, j.company, null));
  }
  return keys;
}

export function isDuplicateByKey(
  keys: Set<string>,
  title: string | null,
  company: string | null
): boolean {
  return keys.has(jobKey(title, company, null));
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
