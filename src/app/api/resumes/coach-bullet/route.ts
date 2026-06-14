/**
 * POST /api/resumes/coach-bullet
 *
 * Single-bullet improvement endpoint. Pair with the per-bullet "Coach" button
 * in ProfileEditor and the inline coach pass in render-preview's diff sidebar.
 *
 * Body: { bullet, role: { title, company }, jdText?, userSkills?, mode? }
 * Returns: { original, improved, rationale, placeholders, confidence }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth";
import {
  coachBullet,
  BulletCoachInputSchema,
} from "@/lib/agents/bullet-coach";
import { QuotaExceededError, formatRetryMessage } from "@/lib/quota/quota";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const __auth = await requireAuthUserId();
  if (__auth.response) return __auth.response;
  const { userId } = __auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BulletCoachInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await coachBullet(parsed.data, {
      quota: { userId, route: "/api/resumes/coach-bullet" },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "ai_quota_exceeded",
          reason: err.reason,
          message: formatRetryMessage(err.reason, err.retryAfterSeconds),
          retryAfterSeconds: err.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
    const message = err instanceof Error ? err.message : "Bullet coaching failed";
    await captureError(err, { route: "/api/resumes/coach-bullet" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
