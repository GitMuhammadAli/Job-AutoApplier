export default function AddJobLoading() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-7 w-36" />
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-56" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="animate-pulse rounded bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-20" />
            <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-10 w-full" />
          </div>
        ))}
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-10 w-32" />
      </div>
    </div>
  );
}
