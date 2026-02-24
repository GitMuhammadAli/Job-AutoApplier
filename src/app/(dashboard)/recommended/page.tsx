import { getAuthUserId } from "@/lib/auth";
import { getRecommendedJobs, type RecommendationOptions } from "@/lib/matching/recommendation-engine";
import { RecommendedClient } from "./client";

export const dynamic = "force-dynamic";

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
  };
}

export default async function RecommendedPage({ searchParams }: PageProps) {
  const userId = await getAuthUserId();

  const options: RecommendationOptions = {
    page: parseInt(searchParams.page || "1") || 1,
    pageSize: 50,
    sortBy: searchParams.sort === "date" ? "date" : "score",
    minScore: parseInt(searchParams.minScore || "0") || 0,
    searchQuery: searchParams.q || undefined,
    hasEmail: searchParams.email === "true",
    jobType: searchParams.type || undefined,
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

  const result = await getRecommendedJobs(userId, options);

  return (
    <RecommendedClient
      jobs={result.jobs}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      timing={result.timing}
      sourceCounts={result.sourceCounts}
      filterBreakdown={result.filterBreakdown}
      currentFilters={{
        source: searchParams.source || null,
        sort: searchParams.sort || "score",
        minScore: searchParams.minScore || "0",
        location: searchParams.location || null,
        type: searchParams.type || null,
        email: searchParams.email || null,
        q: searchParams.q || null,
      }}
    />
  );
}
