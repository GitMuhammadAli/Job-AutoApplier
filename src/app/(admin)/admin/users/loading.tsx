export default function AdminUsersLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-8 w-32" />
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-56" />
      </div>
      {/* Table header */}
      <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-10 w-full" />
      {/* Table rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-12 w-full" />
      ))}
    </div>
  );
}
