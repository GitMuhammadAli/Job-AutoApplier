interface FreshnessIndicatorProps {
  lastSeenAt: Date | string | null;
  firstSeenAt: Date | string | null;
  isActive: boolean;
}

function getHoursAgo(date: Date | string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
}

export function FreshnessIndicator({ lastSeenAt, firstSeenAt, isActive }: FreshnessIndicatorProps) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-zinc-600" />
        Deactivated
      </span>
    );
  }

  const hours = getHoursAgo(lastSeenAt) ?? getHoursAgo(firstSeenAt);
  if (hours === null) return null;

  const days = Math.floor(hours / 24);

  if (hours < 24) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Fresh
      </span>
    );
  }

  if (hours < 72) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {days}d ago
      </span>
    );
  }

  if (hours < 168) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        {days}d ago — may be filled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      {days}d ago — likely expired
    </span>
  );
}

export function FreshnessDot({ lastSeenAt, firstSeenAt }: { lastSeenAt?: Date | string | null; firstSeenAt?: Date | string | null }) {
  const hours = getHoursAgo(lastSeenAt ?? null) ?? getHoursAgo(firstSeenAt ?? null);
  if (hours === null) return null;

  const color = hours < 24
    ? "bg-emerald-500"
    : hours < 72
      ? "bg-amber-500"
      : hours < 168
        ? "bg-orange-500"
        : "bg-red-500";

  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}
