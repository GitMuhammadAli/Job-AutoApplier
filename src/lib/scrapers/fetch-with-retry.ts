import { TIMEOUTS } from "@/lib/constants";

/**
 * Fetch wrapper with automatic retry, 429 handling, exponential backoff,
 * and optional time-budget awareness for Vercel 10s function limits.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxRetries = 2,
  deadline?: number,
): Promise<Response> {
  let lastError: unknown;
  const perCallTimeout = TIMEOUTS.SCRAPER_API_TIMEOUT_MS;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Bail if we're past the deadline
    if (deadline && Date.now() >= deadline) {
      throw new Error("SCRAPER_DEADLINE");
    }

    try {
      // Use the shorter of per-call timeout or remaining deadline
      const remaining = deadline ? Math.max(deadline - Date.now(), 2000) : perCallTimeout;
      const timeout = Math.min(perCallTimeout, remaining);

      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(timeout),
      });

      if (res.status === 429) {
        if (deadline && Date.now() >= deadline - 1000) break; // No time to retry
        const retryAfter = res.headers.get("retry-after");
        const waitMs = Math.min(
          retryAfter ? parseInt(retryAfter, 10) * 1000 || 3000 : 2000 * Math.pow(2, attempt),
          3000, // Cap wait to 3s to stay within budget
        );
        console.warn(`[Scraper] 429 rate-limited, waiting ${waitMs}ms (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (res.status >= 500 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        if (deadline && Date.now() >= deadline - 1000) break; // No time to retry
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
