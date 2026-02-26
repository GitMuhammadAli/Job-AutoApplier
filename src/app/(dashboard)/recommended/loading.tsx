import { RecommendedJobsSkeleton } from "@/components/shared/Skeletons";
import { Sparkles } from "lucide-react";

export default function RecommendedLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Recommended Jobs
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            AI-matched jobs based on your profile
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 ring-1 ring-blue-100 dark:ring-blue-900/40">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              Loading matches…
            </span>
          </div>
        </div>
      </div>
      <RecommendedJobsSkeleton />
    </div>
  );
}
