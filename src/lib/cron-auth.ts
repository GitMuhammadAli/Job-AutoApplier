import { NextRequest, NextResponse } from "next/server";

/**
 * Verify the cron secret from request headers or query params.
 * Supports: Authorization Bearer, x-cron-secret header, or ?secret= query param.
 */
export function verifyCronSecret(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false;
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

/**
 * Standard 401 response for unauthorized cron requests.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
