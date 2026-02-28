import { SystemHealthSkeleton } from "@/components/shared/Skeletons";

export default function SystemHealthLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">System Health</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Monitor search status, API usage, and system performance.
        </p>
      </div>
      <SystemHealthSkeleton />
    </div>
  );
}
