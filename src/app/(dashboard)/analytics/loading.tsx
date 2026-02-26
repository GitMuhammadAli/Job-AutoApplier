import { AnalyticsSkeleton } from "@/components/shared/Skeletons";
import { BarChart3 } from "lucide-react";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
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
      <AnalyticsSkeleton />
    </div>
  );
}
