export default function ResumesLoading() {
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="h-8 w-40 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
