/**
 * GET /api/cron/resume-warmup
 *
 * Launches Chromium and closes it immediately. Pre-pays the cold-start tax
 * so the first user-triggered render or auto-apply attachment doesn't wait
 * 3–5 seconds for the binary to boot.
 *
 * Wired in vercel.json as a cron — runs every 10 minutes during business
 * hours by default. Free-tier Vercel allows 1 cron per project; if that
 * slot is taken, schedule via cron-job.org and POST here with a secret.
 *
 * Auth: requires CRON_SECRET header (same convention as the other cron jobs
 * in this project).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { warmupChromium } from "@/lib/resume/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await warmupChromium();
  const status = result.ok ? 200 : 503;
  return NextResponse.json(result, { status });
}
