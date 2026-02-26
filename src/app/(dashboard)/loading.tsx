import { KanbanSkeleton } from "@/components/shared/Skeletons";

export default function DashboardRootLoading() {
  return (
    <div className="space-y-5">
      <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-10" />
      <div className="space-y-2">
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-7 w-36" />
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-64" />
      </div>
      <KanbanSkeleton />
    </div>
  );
}
