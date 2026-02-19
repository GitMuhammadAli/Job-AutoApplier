import { NextRequest, NextResponse } from "next/server";

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
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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

if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    rateLimitMap.forEach((val, key) => {
      if (now > val.resetTime) rateLimitMap.delete(key);
    });
  };
  setInterval(cleanup, 300_000);
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/cron") || path.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);

  const matchingRule = Object.entries(PATH_LIMITS).find(([p]) =>
    path.startsWith(p)
  );

  if (matchingRule) {
    const [, limit] = matchingRule;
    const key = `${ip}:${path}`;
    const result = isRateLimited(key, limit);
    if (result.limited) {
      return NextResponse.json(
        {
          error: "Too many requests. Please slow down.",
          retryAfterMs: result.retryAfterMs,
        },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/auth")) {
    const key = `auth:${ip}`;
    const result = isRateLimited(key, DEFAULT_LIMITS.auth);
    if (result.limited) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a minute." },
        { status: 429 }
      );
    }
  } else if (path.startsWith("/api/")) {
    const key = `api:${ip}`;
    const result = isRateLimited(key, DEFAULT_LIMITS.api);
    if (result.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
