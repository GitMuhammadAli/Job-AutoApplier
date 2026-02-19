export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        <div className="h-48 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      </div>
      <div className="h-64 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
    </div>
  );
}
