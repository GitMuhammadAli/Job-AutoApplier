export default function TemplatesLoading() {
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-200/70 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
