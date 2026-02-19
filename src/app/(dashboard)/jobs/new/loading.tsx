export default function AddJobLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">
      <div>
        <div className="h-8 w-32 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        <div className="h-4 w-64 mt-2 rounded bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        ))}
        <div className="h-32 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      </div>
    </div>
  );
}
