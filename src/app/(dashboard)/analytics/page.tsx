import { getAnalytics } from "@/app/actions/analytics";
import { StatsBar } from "@/components/analytics/StatsBar";
import { Charts } from "@/components/analytics/Charts";
import { getJobs } from "@/app/actions/job";
import { BarChart3, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [analytics, jobs] = await Promise.all([
    getAnalytics(),
    getJobs(),
  ]);

  const appliedCount = jobs.filter((j) => j.stage !== "SAVED").length;
  const interviewRate = appliedCount > 0
    ? Math.round((jobs.filter((j) => j.stage === "INTERVIEW").length / appliedCount) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          </div>
          <p className="text-sm text-slate-500">
            Track your job search performance and optimize your strategy.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 ring-1 ring-violet-100">
          <TrendingUp className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-semibold text-violet-700">{interviewRate}% interview rate</span>
        </div>
      </div>

      <StatsBar jobs={jobs as any} />

      <Charts
        applicationsOverTime={analytics.applicationsOverTime}
        stageFunnel={analytics.stageFunnel}
        sourceBreakdown={analytics.sourceBreakdown}
        activityOverTime={analytics.activityOverTime}
      />
    </div>
  );
}
