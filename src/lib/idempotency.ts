/**
 * Idempotency helper for expensive POST routes.
 *
 * The page-leave bug: client fires POST /api/resumes/generate, navigates
 * away before the response lands, then retries the same request on
 * remount. The server runs the 60s pipeline twice — burns tokens, makes
 * two ResumeGeneration rows, costs money.
 *
 * Fix: client mints a stable Idempotency-Key (uuid v4) and re-sends it
 * with each retry. Server returns the cached response for the same key
 * within a TTL window.
 *
 * Implementation: in-memory LRU per Node worker. Not cross-instance —
 * the same retry hitting a different Vercel function instance falls
 * through and re-runs. Acceptable for now: most retries within ~5s land
 * on the same warm container, and the alternative is a Redis or DB
 * round-trip on every request. Promote to Upstash when the false-retry
 * cost exceeds the cache miss cost.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  promise?: Promise<T>;     // in-flight — concurrent retries await this
  value?: T;                // settled result, served from cache
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function evictExpired(now: number): void {
  // Bounded eviction — at most 16 entries per call so worst-case cost stays
  // O(16) instead of O(n). Combined with insertion-order eviction below this
  // keeps the cache from growing unbounded under bad clients.
  let scanned = 0;
  cache.forEach((entry, key) => {
    if (scanned++ >= 16) return;
    if (entry.expiresAt < now) cache.delete(key);
  });
  if (cache.size > MAX_ENTRIES) {
    const overflow = cache.size - MAX_ENTRIES;
    const keys = cache.keys();
    for (let i = 0; i < overflow; i++) {
      const k = keys.next().value;
      if (k !== undefined) cache.delete(k);
    }
  }
}

/**
 * Run `fn` exactly once per (scope, key) within the TTL window. Concurrent
 * requests with the same key await the same in-flight promise.
 *
 * `scope` namespaces keys per-route so a key collision across routes is
 * impossible. Pass the userId in the scope as well for per-user isolation:
 *   await runIdempotent(`generate:${userId}`, key, ttl, fn)
 */
export async function runIdempotent<T>(
  scope: string,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const fullKey = `${scope}::${key}`;
  const now = Date.now();
  evictExpired(now);

  const existing = cache.get(fullKey) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    if (existing.value !== undefined) return existing.value;
    if (existing.promise) return existing.promise;
  }

  const entry: CacheEntry<T> = {
    expiresAt: now + (ttlMs || DEFAULT_TTL_MS),
  };
  const promise = fn()
    .then((value) => {
      entry.value = value;
      entry.promise = undefined;
      return value;
    })
    .catch((err) => {
      // On error, remove so the next retry can re-run instead of caching
      // a transient failure.
      cache.delete(fullKey);
      throw err;
    });
  entry.promise = promise;
  cache.set(fullKey, entry as CacheEntry<unknown>);
  return promise;
}

/** Test helper — clears the LRU between specs. */
export function _resetIdempotencyCache(): void {
  cache.clear();
}

/**
 * Validate an Idempotency-Key header value. Accept v4-uuid-shape OR any
 * 16-128 char ascii string (clients are free to use their own scheme).
 */
export function isValidIdempotencyKey(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length < 16 || value.length > 128) return false;
  return /^[A-Za-z0-9_\-:.]+$/.test(value);
}
