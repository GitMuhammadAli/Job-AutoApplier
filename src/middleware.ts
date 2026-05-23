import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT } from "@/lib/messages";

// NOTE: In-memory rate limiting is per-instance on Vercel serverless.
// Each cold start gets a fresh Map, so limits are best-effort, not strict.
// For production-grade rate limiting, use Vercel KV or Upstash Redis.
const rateLimitMap = new Map<
  string,
  { count: number; resetTime: number }
>();

const PATH_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/applications/generate": { max: 20, windowMs: 60_000 },
  "/api/applications/bulk-send": { max: 5, windowMs: 60_000 },
  "/api/email/test": { max: 3, windowMs: 300_000 },
  "/api/jobs/scan-now": { max: 1, windowMs: 300_000 },
  "/api/export": { max: 2, windowMs: 3_600_000 },
  "/api/resumes/upload": { max: 10, windowMs: 60_000 },
};

const DEFAULT_LIMITS: Record<string, { max: number; windowMs: number }> = {
  auth: { max: 10, windowMs: 60_000 },
  api: { max: 60, windowMs: 60_000 },
  // /api/auth/session is read by <SessionProvider> on every page load. Cap is
  // high enough not to break normal browsing across tabs, low enough to stop
  // a script hammering the endpoint thousands of times/sec.
  sessionRead: { max: 120, windowMs: 60_000 },
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Per-user rate-limit dimension to avoid NAT collateral DoS (corporate networks,
 * mobile carriers, university WiFi).
 *
 * NextAuth's database-session cookie is opaque + unguessable, so a short hash of
 * its value is a stable per-session identifier. Anonymous traffic (no cookie)
 * falls back to IP, which is the previous behavior.
 */
function getUserKey(req: NextRequest): string {
  const cookie =
    req.cookies.get("__Secure-next-auth.session-token")?.value ??
    req.cookies.get("next-auth.session-token")?.value;
  if (!cookie) return `ip:${getClientIp(req)}`;
  // Short truncation — cookie itself is high-entropy, prefix is enough to
  // identify the session without burning a hash in middleware hot path
  return `usr:${cookie.slice(0, 16)}`;
}

function isRateLimited(
  key: string,
  limit: { max: number; windowMs: number }
): { limited: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + limit.windowMs });
    return { limited: false };
  }

  entry.count++;
  if (entry.count > limit.max) {
    return { limited: true, retryAfterMs: entry.resetTime - now };
  }
  return { limited: false };
}

// Inline cleanup on each request instead of setInterval (which leaks in serverless)
let lastCleanup = 0;
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // max once per minute
  lastCleanup = now;
  rateLimitMap.forEach((val, key) => {
    if (now > val.resetTime) rateLimitMap.delete(key);
  });
}

export function middleware(req: NextRequest) {
  cleanupStaleEntries();
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/cron") || path.startsWith("/api/webhooks")) {
    const ip = getClientIp(req);
    const result = isRateLimited(`cron:${ip}`, { max: 30, windowMs: 60_000 });
    if (result.limited) {
      return NextResponse.json({ error: RATE_LIMIT.TOO_MANY_REQUESTS }, { status: 429 });
    }
    return NextResponse.next();
  }

  // Per-user-or-IP key — defeats NAT collateral DoS where many users behind
  // a single egress IP get rate-limited together
  const userKey = getUserKey(req);

  const matchingRule = Object.entries(PATH_LIMITS).find(([p]) =>
    path.startsWith(p)
  );

  if (matchingRule) {
    const [, limit] = matchingRule;
    const key = `${userKey}:${path}`;
    const result = isRateLimited(key, limit);
    if (result.limited) {
      return NextResponse.json(
        {
          error: RATE_LIMIT.TOO_MANY_REQUESTS_SLOW,
          retryAfterMs: result.retryAfterMs,
        },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/auth")) {
    const isSessionRead =
      path === "/api/auth/session" || path === "/api/auth/csrf";
    if (isSessionRead) {
      // Apply a generous cap so <SessionProvider> works across tabs but
      // a script hammering thousands/sec still gets stopped (B3 fix).
      const key = `session-read:${userKey}`;
      const result = isRateLimited(key, DEFAULT_LIMITS.sessionRead);
      if (result.limited) {
        return NextResponse.json(
          { error: RATE_LIMIT.TOO_MANY_REQUESTS_SLOW },
          { status: 429 }
        );
      }
    } else {
      const key = `auth:${userKey}`;
      const result = isRateLimited(key, DEFAULT_LIMITS.auth);
      if (result.limited) {
        return NextResponse.json(
          { error: RATE_LIMIT.TOO_MANY_LOGIN_ATTEMPTS },
          { status: 429 }
        );
      }
    }
  } else if (path.startsWith("/api/")) {
    const key = `api:${userKey}`;
    const result = isRateLimited(key, DEFAULT_LIMITS.api);
    if (result.limited) {
      return NextResponse.json(
        { error: RATE_LIMIT.TOO_MANY_REQUESTS_SLOW },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
