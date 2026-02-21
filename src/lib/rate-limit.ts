/**
 * In-memory per-user rate limiter with configurable windows and limits.
 * Suitable for serverless — entries expire automatically via TTL sweeping.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const ACTION_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  "ai-generate": { windowMs: 60_000, maxRequests: 5 },
  "scan-now": { windowMs: 5 * 60_000, maxRequests: 1 },
  "send-email": { windowMs: 60_000, maxRequests: 10 },
  "application-generate": { windowMs: 60_000, maxRequests: 5 },
  "cover-letter": { windowMs: 60_000, maxRequests: 5 },
  default: { windowMs: 60_000, maxRequests: 30 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

function sweepExpired(): void {
  const now = Date.now();
  const keys = Array.from(rateLimitMap.keys());
  for (const key of keys) {
    const entry = rateLimitMap.get(key);
    if (!entry) continue;
    entry.timestamps = entry.timestamps.filter(
      (ts: number) => now - ts < 10 * 60_000
    );
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}

let lastSweep = 0;
const SWEEP_INTERVAL = 60_000;

export function checkRateLimit(
  userId: string,
  action: string
): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL) {
    sweepExpired();
    lastSweep = now;
  }

  const config = ACTION_LIMITS[action] || ACTION_LIMITS.default;
  const key = `${userId}:${action}`;

  let entry = rateLimitMap.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < config.windowMs
  );

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = config.windowMs - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 1000),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
  };
}

export function resetRateLimit(userId: string, action: string): void {
  rateLimitMap.delete(`${userId}:${action}`);
}
