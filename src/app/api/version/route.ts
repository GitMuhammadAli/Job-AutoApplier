/**
 * GET /api/version
 *
 * Returns a build identifier that changes on every deploy. The client-side
 * <UpdateBanner /> polls this every 60s; when the value drifts from the
 * id it cached on mount, the banner prompts a refresh.
 *
 * Sources of truth, in order:
 *   1. VERCEL_GIT_COMMIT_SHA — set automatically on Vercel deploys
 *   2. NEXT_BUILD_ID — set by `next build` and exposed via env at build time
 *   3. "dev" — local development fallback (banner won't fire since value is stable)
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    process.env.NEXT_BUILD_ID ??
    "dev";
  return NextResponse.json({ buildId });
}
