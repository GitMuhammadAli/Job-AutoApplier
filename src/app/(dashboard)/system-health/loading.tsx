export default function SystemHealthLoading() {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
    </div>
  );
}
