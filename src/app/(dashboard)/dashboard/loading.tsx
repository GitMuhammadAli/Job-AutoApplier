import { KanbanSkeleton } from "@/components/shared/Skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Status banner skeleton */}
      <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-10" />

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-7 w-36" />
          <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-8 w-20" />
          <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-8 w-28" />
        </div>
      </div>

      {/* Widgets skeleton */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
        <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
      </div>

      {/* Kanban skeleton */}
      <KanbanSkeleton />
    </div>
  );
}
