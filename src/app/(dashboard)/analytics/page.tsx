import { Suspense } from "react";
import { getAnalytics } from "@/app/actions/analytics";
import { StatsBar } from "@/components/analytics/StatsBar";
import { SpeedMetrics } from "@/components/analytics/SpeedMetrics";
import { WeeklyComparison } from "@/components/analytics/WeeklyComparison";
import { KeywordEffectiveness } from "@/components/analytics/KeywordEffectiveness";
import { AnalyticsSkeleton } from "@/components/shared/Skeletons";
import { BarChart3, TrendingUp, Loader2 } from "lucide-react";
import nextDynamic from "next/dynamic";

const Charts = nextDynamic(
  () => import("@/components/analytics/Charts").then((m) => m.Charts),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    ),
  },
);

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 animate-page-enter">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
          Performance
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40">
            <BarChart3 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Analytics
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
          How your job search is performing — and what to adjust.
        </p>
      </header>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </div>
  );
}

async function AnalyticsContent() {
  let analytics: Awaited<ReturnType<typeof getAnalytics>> | null = null;

  try {
    analytics = await getAnalytics();
  } catch (error) {
    console.error("[AnalyticsPage] Failed to load data:", error);
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/60 dark:bg-stone-900/60 p-8">
        <p className="text-[13px] text-stone-500 dark:text-stone-400">
          We couldn't load your analytics right now. Refresh the page to try again.
        </p>
      </div>
    );
  }

  const { applied, interviews, offers } = analytics;
  const interviewRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

  return (
    <>
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
          <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200 tabular-nums">
            {interviewRate}% interview rate
          </span>
        </div>
      </div>

      <SpeedMetrics metrics={analytics.speedMetrics} />

      <StatsBar analytics={analytics} />

      {analytics.weeklyComparison && (
        <WeeklyComparison data={analytics.weeklyComparison} />
      )}

      {analytics.keywordEffectiveness && analytics.keywordEffectiveness.length > 0 && (
        <KeywordEffectiveness data={analytics.keywordEffectiveness} />
      )}

      <Charts
        applicationsOverTime={analytics.applicationsOverTime}
        stageFunnel={analytics.stageFunnel}
        sourceBreakdown={analytics.sourceBreakdown}
        activityOverTime={analytics.activityOverTime}
        applyMethodBreakdown={analytics.applyMethodBreakdown}
        speedOverTime={analytics.speedOverTime}
        matchScoreDistribution={analytics.matchScoreDistribution}
        responseRateBreakdown={analytics.responseRateBreakdown}
        topCompanies={analytics.topCompanies}
      />
    </>
  );
}
