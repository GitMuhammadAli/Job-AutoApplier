import { ApplicationsSkeleton } from "@/components/shared/Skeletons";

export default function ApplicationsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Applications
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Manage your prepared applications before sending
        </p>
      </div>
      <ApplicationsSkeleton />
    </div>
  );
}
