import { Suspense } from "react";
import { getAuthUserId } from "@/lib/auth";
import { getRecommendedJobs, type RecommendationOptions } from "@/lib/matching/recommendation-engine";
import { RecommendedClient } from "./client";
import { RecommendedJobsSkeleton } from "@/components/shared/Skeletons";
import { getRecentScraperFailures } from "@/lib/scrapers/scraper-status";
import { ScraperStatusBanner } from "@/components/jobs/ScraperStatusBanner";

interface PageProps {
  searchParams: {
    source?: string;
    sort?: string;
    minScore?: string;
    page?: string;
    type?: string;
    location?: string;
    email?: string;
    q?: string;
    ref?: string;
    fresh?: string; // "today" | "3days" | "week" — caps server-side maxDays
  };
}

const FRESHNESS_DAYS: Record<string, number> = {
  today: 1,
  "3days": 3,
  week: 7,
};

export default function RecommendedPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6 animate-page-enter">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
          Discovery
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Recommended for you
        </h1>
        <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
          Ranked by how well each posting fits your skills, location, and freshness preferences.
        </p>
      </header>

      <Suspense fallback={<RecommendedJobsSkeleton />}>
        <RecommendedJobsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RecommendedJobsList({ searchParams }: { searchParams: PageProps["searchParams"] }) {
  const userId = await getAuthUserId();

  const options: RecommendationOptions = {
    page: parseInt(searchParams.page || "1") || 1,
    pageSize: 20,
    sortBy: searchParams.sort === "date" ? "date" : "score",
    minScore: parseInt(searchParams.minScore || "0") || 0,
    searchQuery: searchParams.q || undefined,
    hasEmail: searchParams.email === "true",
    emailFilter: (["all", "verified", "none"].includes(searchParams.email || ""))
      ? searchParams.email as "all" | "verified" | "none"
      : undefined,
    jobType: searchParams.type || undefined,
    // Server-side window cap so "Today" doesn't pull 2000 month-old candidates
    // just to trim them client-side.
    ...(searchParams.fresh && FRESHNESS_DAYS[searchParams.fresh]
      ? { maxDays: FRESHNESS_DAYS[searchParams.fresh] }
      : {}),
  };

  if (searchParams.source) {
    options.sources = searchParams.source.split(",").filter(Boolean);
  }

  if (searchParams.location) {
    const loc = searchParams.location as RecommendationOptions["locationFilter"];
    if (["all", "city", "country", "remote"].includes(loc!)) {
      options.locationFilter = loc;
    }
  }

  // Fetch jobs + scraper-failure diagnostics in parallel — so when the user's
  // list looks empty, we can immediately tell them whether it's "no matches"
  // or "scraper X is broken / API key invalid / blocked by captcha".
  const [result, scraperFailures] = await Promise.all([
    getRecommendedJobs(userId, options),
    getRecentScraperFailures().catch((err) => {
      console.warn("[recommended] scraper-status fetch failed:", err);
      return [];
    }),
  ]);

  return (
    <>
      <ScraperStatusBanner failures={scraperFailures} />
      <RecommendedClient
        jobs={result.jobs}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      timing={result.timing}
      sourceCounts={result.sourceCounts}
      filterBreakdown={result.filterBreakdown}
      referrer={searchParams.ref?.startsWith("devradar") ? searchParams.ref : undefined}
      currentFilters={{
        source: searchParams.source || null,
        sort: searchParams.sort || "score",
        minScore: searchParams.minScore || "0",
        location: searchParams.location || null,
        type: searchParams.type || null,
        email: searchParams.email || null,
        q: searchParams.q || null,
        fresh: searchParams.fresh || null,
      }}
      />
    </>
  );
}
