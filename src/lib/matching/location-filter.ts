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
