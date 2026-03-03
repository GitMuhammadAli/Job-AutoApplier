import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget API usage logger. Each call creates a SystemLog entry
 * with type "api_call" so the admin quota dashboard can count usage.
 *
 * Batches writes internally — accumulates calls in memory and flushes
 * periodically to avoid a DB write per API call during scraper bursts.
 */

const pending = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const entries = Array.from(pending.entries());
  pending.clear();
  flushTimer = null;

  for (const [source, count] of entries) {
    try {
      await prisma.systemLog.create({
        data: {
          type: "api_call",
          source,
          message: `${count} API call(s)`,
          metadata: { count },
        },
      });
    } catch (err) {
      console.warn(`[ApiUsageLogger] Failed to log ${source} usage:`, err instanceof Error ? err.message : err);
    }
  }
}

export async function logApiCall(source: string): Promise<void> {
  pending.set(source, (pending.get(source) || 0) + 1);

  if (!flushTimer) {
    // Flush after 2s of inactivity — batches burst calls from scrapers
    flushTimer = setTimeout(() => { flush().catch(() => {}); }, 2000);
  }
}

/**
 * Force flush any pending API call logs. Call this at end of cron runs
 * to ensure counts are written before the function terminates.
 */
export async function flushApiUsageLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.size > 0) {
    await flush();
  }
}
