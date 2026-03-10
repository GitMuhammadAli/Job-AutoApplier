import { prisma } from "@/lib/prisma";

/**
 * API usage logger. Each call writes a SystemLog entry immediately with
 * type "api_call" so the admin quota dashboard can count usage.
 *
 * Writes immediately instead of batching because Vercel serverless functions
 * are isolated per invocation — setTimeout-based batching loses data when
 * the function terminates before the timer fires.
 */
export async function logApiCall(source: string): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        type: "api_call",
        source,
        message: `1 API call(s)`,
        metadata: { count: 1 },
      },
    });
  } catch (err) {
    console.warn(`[ApiUsageLogger] Failed to log ${source} usage:`, err instanceof Error ? err.message : err);
  }
}

/**
 * No-op kept for backward compatibility. logApiCall now writes immediately.
 */
export async function flushApiUsageLogs(): Promise<void> {
  // No-op — writes are immediate now
}
