/**
 * Determine which sources to scrape today.
 * Free sources run daily. Paid sources are rotated to stay within free tier limits.
 */
export function getTodaysSources(): string[] {
  const sources: string[] = [];

  // Free sources — always scrape daily
  sources.push("indeed", "remotive", "arbeitnow", "linkedin", "rozee");

  // JSearch — daily but limited to 6 queries (handled in scraper)
  if (process.env.RAPIDAPI_KEY) {
    sources.push("jsearch");
  }

  // Adzuna — daily, 200/day is generous
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    sources.push("adzuna");
  }

  // SerpAPI (Google Jobs) — every other day (even dates) to conserve 100/month
  const dayOfMonth = new Date().getDate();
  if (process.env.SERPAPI_KEY && dayOfMonth % 2 === 0) {
    sources.push("google");
  }

  return sources;
}
