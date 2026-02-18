import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  auth: { max: 10, windowMs: 60_000 },
  api: { max: 30, windowMs: 60_000 },
};

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(key: string, limit: { max: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + limit.windowMs });
    return false;
  }

  entry.count++;
  return entry.count > limit.max;
}

// Clean up stale entries every 5 minutes
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

  // Skip cron routes (protected by CRON_SECRET already)
  if (path.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);

  if (path.startsWith("/api/auth")) {
    const key = `auth:${ip}`;
    if (isRateLimited(key, LIMITS.auth)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a minute." },
        { status: 429 }
      );
    }
  } else if (path.startsWith("/api/")) {
    const key = `api:${ip}`;
    if (isRateLimited(key, LIMITS.api)) {
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
