/**
 * Fetch wrapper with automatic retry, 429 handling, and exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(15000),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000 || 5000
          : 2000 * Math.pow(2, attempt);
        console.warn(`[Scraper] 429 rate-limited, waiting ${waitMs}ms (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (res.status >= 500 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
