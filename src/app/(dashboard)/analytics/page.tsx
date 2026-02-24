import { getAnalytics } from "@/app/actions/analytics";
import { StatsBar } from "@/components/analytics/StatsBar";
import { Charts } from "@/components/analytics/Charts";
import { SpeedMetrics } from "@/components/analytics/SpeedMetrics";
import { WeeklyComparison } from "@/components/analytics/WeeklyComparison";
import { KeywordEffectiveness } from "@/components/analytics/KeywordEffectiveness";
import { BarChart3, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let analytics: Awaited<ReturnType<typeof getAnalytics>> | null = null;

  try {
    analytics = await getAnalytics();
  } catch (error) {
    console.error("[AnalyticsPage] Failed to load data:", error);
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <p className="text-sm text-slate-500 dark:text-zinc-400">Failed to load analytics data.</p>
      </div>
    );
  }

  const { applied, interviews, offers } = analytics;
  const interviewRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Analytics</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Track your job search performance and optimize your strategy.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 px-3 py-1.5 ring-1 ring-violet-100 dark:ring-violet-800/50">
          <TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
          <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">{interviewRate}% interview rate</span>
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
    </div>
  );
}
