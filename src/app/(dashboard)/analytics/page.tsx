import { getAnalytics } from "@/app/actions/analytics";
import { StatsBar } from "@/components/analytics/StatsBar";
import { Charts } from "@/components/analytics/Charts";
import { getJobs } from "@/app/actions/job";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [analytics, jobs] = await Promise.all([getAnalytics(), getJobs()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="text-sm text-slate-500">
          Track your job search performance
        </p>
      </div>

      <StatsBar jobs={jobs} />

      <Charts
        applicationsOverTime={analytics.applicationsOverTime}
        stageFunnel={analytics.stageFunnel}
        platformBreakdown={analytics.platformBreakdown}
        resumePerformance={analytics.resumePerformance}
        activityOverTime={analytics.activityOverTime}
      />
    </div>
  );
}
