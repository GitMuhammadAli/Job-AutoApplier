import { CronExpressionParser } from "cron-parser";

/**
 * Central registry of all scheduled crons in JobPilot.
 *
 * Source of truth for:
 *   - the `/api/cron-status` endpoint (widget + admin stats)
 *   - computing `nextRunAt` from a cron expression
 *
 * The `key` MUST match the `source` recorded by `createCronTracker(...)` in
 * each cron handler, because widget status is joined via `SystemLog.source`.
 *
 * The `schedule` is a standard 5-field cron expression matching what is
 * configured on the external scheduler (cron-job.org) — see
 * SYSTEM-ARCHITECTURE.md for the canonical list.
 *
 * The `scheduleLabel` is a short human-readable version for UI display.
 */

export type CronCategory =
  | "scraper"
  | "matching"
  | "application"
  | "notification"
  | "followup"
  | "maintenance";

export interface CronDefinition {
  key: string;
  label: string;
  category: CronCategory;
  schedule: string; // 5-field cron expression (UTC)
  scheduleLabel: string; // human-readable label
}

export const CRON_REGISTRY: CronDefinition[] = [
  // Scraping
  {
    key: "scrape-global",
    label: "Scrape Global",
    category: "scraper",
    schedule: "0 */2 * * *",
    scheduleLabel: "Every 2 hours",
  },
  {
    key: "scrape-posts",
    label: "Scrape Posts",
    category: "scraper",
    schedule: "0 */4 * * *",
    scheduleLabel: "Every 4 hours",
  },

  // Matching
  {
    key: "match-all-users",
    label: "Match All Users",
    category: "matching",
    schedule: "0 * * * *",
    scheduleLabel: "Every hour",
  },
  {
    key: "match-jobs",
    label: "Match Jobs",
    category: "matching",
    schedule: "0 */3 * * *",
    scheduleLabel: "Every 3 hours",
  },

  // Application pipeline
  {
    key: "instant-apply",
    label: "Instant Apply",
    category: "application",
    schedule: "*/30 * * * *",
    scheduleLabel: "Every 30 min",
  },
  {
    key: "send-scheduled",
    label: "Send Scheduled",
    category: "application",
    schedule: "*/5 * * * *",
    scheduleLabel: "Every 5 min",
  },
  {
    key: "send-queued",
    label: "Send Queued",
    category: "application",
    schedule: "*/5 * * * *",
    scheduleLabel: "Every 5 min",
  },

  // Notifications
  {
    key: "notify-matches",
    label: "Notify Matches",
    category: "notification",
    schedule: "0 9 * * *",
    scheduleLabel: "Daily 9:00 AM",
  },

  // Follow-ups
  {
    key: "follow-up",
    label: "Follow Up",
    category: "followup",
    schedule: "0 10 * * *",
    scheduleLabel: "Daily 10:00 AM",
  },
  {
    key: "check-follow-ups",
    label: "Check Follow-ups",
    category: "followup",
    schedule: "0 9 * * *",
    scheduleLabel: "Daily 9:00 AM",
  },

  // Maintenance
  {
    key: "cleanup-stale",
    label: "Cleanup Stale",
    category: "maintenance",
    schedule: "0 3 * * *",
    scheduleLabel: "Daily 3:00 AM",
  },
  {
    key: "weekly-report",
    label: "Weekly Report",
    category: "maintenance",
    schedule: "0 8 * * 1",
    scheduleLabel: "Monday 8:00 AM",
  },
];

/**
 * Crons that the admin manual-trigger endpoint supports.
 * Keep in sync with VALID_CRON_ACTIONS in
 * `src/app/api/admin/scrapers/trigger/route.ts`.
 */
export const TRIGGERABLE_CRON_KEYS = new Set<string>([
  "scrape-global",
  "instant-apply",
  "match-jobs",
  "match-all-users",
  "send-scheduled",
  "send-queued",
  "notify-matches",
  "cleanup-stale",
  "follow-up",
  "check-follow-ups",
]);

/**
 * Compute the next run instant for a cron expression.
 * Returns the current time + 1 minute as a safe fallback if parsing fails,
 * so the widget never throws on a malformed entry.
 */
export function getNextRunAt(cronExpression: string, from?: Date): Date {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: from ?? new Date(),
      tz: "UTC",
    });
    return interval.next().toDate();
  } catch {
    return new Date((from ?? new Date()).getTime() + 60_000);
  }
}

/**
 * Approximate interval between successive runs for a cron expression, in ms.
 * Used to classify status (green/yellow/red) based on staleness of lastRunAt.
 */
export function getApproxIntervalMs(cronExpression: string): number {
  try {
    const interval = CronExpressionParser.parse(cronExpression, { tz: "UTC" });
    const a = interval.next().toDate().getTime();
    const b = interval.next().toDate().getTime();
    return Math.max(60_000, b - a);
  } catch {
    return 60 * 60_000; // default 1 hour
  }
}

export function findCronByKey(key: string): CronDefinition | undefined {
  return CRON_REGISTRY.find((c) => c.key === key);
}
