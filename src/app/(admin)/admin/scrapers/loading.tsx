export default function AdminScrapersLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-8 w-36" />
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-64" />
      </div>
      {/* Scraper cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
        ))}
      </div>
    </div>
  );
}
