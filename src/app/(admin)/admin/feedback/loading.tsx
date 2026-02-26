export default function AdminFeedbackLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-8 w-36" />
        <div className="animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70 h-4 w-56" />
      </div>
      {/* Feedback items */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-24" />
      ))}
    </div>
  );
}
