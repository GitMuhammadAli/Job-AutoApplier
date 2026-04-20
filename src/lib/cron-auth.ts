import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

let _cronSecretMissing = false;

/**
 * Verify the cron secret from request headers or query params.
 * Supports: Authorization Bearer, x-cron-secret header, or ?secret= query param.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[CronAuth] CRON_SECRET env var is not set — all cron requests will be rejected");
    _cronSecretMissing = true;
    return false;
  }
  _cronSecretMissing = false;
  // Accept secret via headers or ?secret= query param (for cron-job.org)
  const fromHeader =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret");
  const fromQuery = req.nextUrl.searchParams.get("secret");
  const secret = fromHeader || fromQuery;
  if (!secret) return false;

  if (fromQuery && !fromHeader) {
    console.warn(
      `[CronAuth] Secret passed via query param for ${req.nextUrl.pathname} — prefer Authorization header to avoid secret leaking in logs/referrers`,
    );
  }
  try {
    const a = Buffer.from(secret);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Standard 401 response for unauthorized cron requests.
 * Writes to SystemLog when CRON_SECRET is missing so admin panel can surface the issue.
 */
export function unauthorizedResponse(): NextResponse {
  if (_cronSecretMissing) {
    prisma.systemLog.create({
      data: {
        type: "cron-run",
        source: "cron-auth",
        message: "[ERR] CRON_SECRET env var is not set — all crons are blocked",
        metadata: { status: "error", errorMessage: "CRON_SECRET missing" },
      },
    }).catch(() => {});
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
