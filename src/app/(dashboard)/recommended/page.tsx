import { Suspense } from "react";
import { getAuthUserId } from "@/lib/auth";
import { getRecommendedJobs, type RecommendationOptions } from "@/lib/matching/recommendation-engine";
import { RecommendedClient } from "./client";
import { RecommendedJobsSkeleton } from "@/components/shared/Skeletons";

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

export default function RecommendedPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-4 animate-slide-up">
      {/* Static header — renders instantly */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Recommended Jobs
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Jobs that match your skills and preferences
        </p>
      </div>

      {/* Async data streams in via Suspense */}
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
