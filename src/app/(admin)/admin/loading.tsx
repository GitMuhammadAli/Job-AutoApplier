export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-8 w-48" />
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-72" />
      </div>
      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-20" />
        ))}
      </div>
      {/* Secondary stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-20" />
        ))}
      </div>
      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-48" />
        <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-48" />
      </div>
    </div>
  );
}
