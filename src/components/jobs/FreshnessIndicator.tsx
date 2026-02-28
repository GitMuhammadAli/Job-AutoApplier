interface FreshnessIndicatorProps {
  lastSeenAt: Date | string | null;
  firstSeenAt: Date | string | null;
  isActive: boolean;
}

function getHoursAgo(date: Date | string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
}

function getFreshnessInfo(hours: number) {
  const days = Math.floor(hours / 24);
  if (hours < 24) {
    return {
      label: "Fresh — posted today",
      shortLabel: "Fresh",
      dotClass: "bg-emerald-500",
      badgeBg: "bg-emerald-50 dark:bg-emerald-900/30",
      badgeText: "text-emerald-700 dark:text-emerald-300",
      days,
    };
  }
  if (hours < 72) {
    return {
      label: `${days}d ago — still active`,
      shortLabel: `${days}d ago`,
      dotClass: "bg-amber-500",
      badgeBg: "bg-amber-50 dark:bg-amber-900/30",
      badgeText: "text-amber-700 dark:text-amber-300",
      days,
    };
  }
  if (hours < 168) {
    return {
      label: `${days}d ago — may be filled`,
      shortLabel: `${days}d old`,
      dotClass: "bg-orange-500",
      badgeBg: "bg-orange-50 dark:bg-orange-900/30",
      badgeText: "text-orange-700 dark:text-orange-300",
      days,
    };
  }
  return {
    label: `${days}d ago — likely expired`,
    shortLabel: `${days}d old`,
    dotClass: "bg-red-500",
    badgeBg: "bg-red-50 dark:bg-red-900/30",
    badgeText: "text-red-700 dark:text-red-300",
    days,
  };
}

/**
 * Full badge with colored dot + text label.
 * Used on job detail page header.
 */
export function FreshnessIndicator({ lastSeenAt, firstSeenAt, isActive }: FreshnessIndicatorProps) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500">
        <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-600" />
        Deactivated
      </span>
    );
  }

  const hours = getHoursAgo(lastSeenAt) ?? getHoursAgo(firstSeenAt);
  if (hours === null) return null;

  const info = getFreshnessInfo(hours);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${info.badgeBg} ${info.badgeText}`}
      title={info.label}
    >
      <span className={`h-2 w-2 rounded-full ${info.dotClass}`} />
      {info.shortLabel}
    </span>
  );
}

/**
 * Compact indicator — colored dot + short label.
 * Used on kanban cards, recommended cards, application cards.
 * Includes a tooltip so users understand what the colors mean.
 */
export function FreshnessDot({ lastSeenAt, firstSeenAt }: { lastSeenAt?: Date | string | null; firstSeenAt?: Date | string | null }) {
  const hours = getHoursAgo(lastSeenAt ?? null) ?? getHoursAgo(firstSeenAt ?? null);
  if (hours === null) return null;

  const info = getFreshnessInfo(hours);

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium ${info.badgeText}`}
      title={info.label}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${info.dotClass} flex-shrink-0`} />
      <span className="hidden sm:inline">{info.shortLabel}</span>
    </span>
  );
}
