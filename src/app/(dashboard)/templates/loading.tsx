export default function TemplatesLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-7 w-36" />
        <div className="mt-2 animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
        ))}
      </div>
    </div>
  );
}
