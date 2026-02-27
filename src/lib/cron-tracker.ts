import { prisma } from "@/lib/prisma";

/**
 * Standardized cron run tracking via SystemLog.
 * Every cron should use createCronTracker() at the top of its handler
 * and call .success(), .error(), or .skipped() before returning.
 *
 * The admin panel queries these records to show cron health, last run, durations.
 * All records use type="cron-run" so they can be distinguished from other SystemLog entries.
 */

interface CronRunData {
  processed?: number;
  failed?: number;
  metadata?: Record<string, unknown>;
}

async function writeLog(data: Parameters<typeof prisma.systemLog.create>[0]["data"]) {
  try {
    await prisma.systemLog.create({ data });
  } catch (firstErr) {
    // Single retry after 500ms for transient DB blips
    try {
      await new Promise((r) => setTimeout(r, 500));
      await prisma.systemLog.create({ data });
    } catch (retryErr) {
      console.error(`[CronTracker] Failed to write log after retry (source: ${data.source}):`, retryErr instanceof Error ? retryErr.message : retryErr);
    }
  }
}

export function createCronTracker(cronName: string) {
  const startTime = Date.now();

  return {
    async success(data?: CronRunData) {
      const durationMs = Date.now() - startTime;
      await writeLog({
        type: "cron-run",
        source: cronName,
        message: `[OK] ${cronName} completed in ${durationMs}ms${data?.processed != null ? ` — ${data.processed} processed` : ""}${data?.failed ? `, ${data.failed} failed` : ""}`,
        metadata: {
          status: "success",
          durationMs,
          processed: data?.processed ?? 0,
          failed: data?.failed ?? 0,
          ...data?.metadata,
        },
      });
    },

    async error(error: string | Error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        typeof error === "string" ? error : error.message;
      await writeLog({
        type: "cron-run",
        source: cronName,
        message: `[ERR] ${cronName} failed after ${durationMs}ms: ${errorMessage}`,
        metadata: {
          status: "error",
          durationMs,
          errorMessage,
        },
      });
    },

    async skipped(reason: string) {
      const durationMs = Date.now() - startTime;
      await writeLog({
        type: "cron-run",
        source: cronName,
        message: `[SKIP] ${cronName}: ${reason}`,
        metadata: {
          status: "skipped",
          durationMs,
          reason,
        },
      });
    },
  };
}
