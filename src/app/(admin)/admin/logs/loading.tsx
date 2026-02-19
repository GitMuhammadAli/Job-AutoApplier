export default function AdminLogsLoading() {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      <div className="flex gap-3">
        <div className="h-10 w-40 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        <div className="h-10 w-40 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
