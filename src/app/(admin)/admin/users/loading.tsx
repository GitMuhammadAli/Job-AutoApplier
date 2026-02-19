export default function AdminUsersLoading() {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
