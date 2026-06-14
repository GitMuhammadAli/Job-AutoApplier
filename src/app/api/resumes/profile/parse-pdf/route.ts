/**
 * POST /api/resumes/profile/parse-pdf
 *
 * Input:  { resumeId: string }    — existing JobPilot Resume (uploaded PDF)
 * Output: { candidate: ResumeProfile }  — AI-extracted candidate, NOT saved
 *
 * Critical contract: this endpoint NEVER saves anything. It returns a
 * candidate profile that the user reviews + confirms in the wizard, then
 * the wizard POSTs to PUT /api/resumes/profile to persist.
 *
 * Shares parse logic with /api/resumes/generate via the helper, so the
 * "AI extracts your uploaded resume" code path is exercised the same way
 * whether triggered by the wizard (explicit review) or generate (implicit
 * fallback when structured profile is empty).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUserId } from "@/lib/auth";
import { parseUploadedPdfToProfile } from "@/lib/resume/parse-uploaded-pdf";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ resumeId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  let result;
  try {
    result = await parseUploadedPdfToProfile(parsed.data.resumeId, userId, {
      quota: { userId, route: "/api/resumes/profile/parse-pdf" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Parse failed";
    const status = msg.includes("not found") ? 404 : msg.includes("extractable text") ? 422 : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  if (!result.profile) {
    // Partial / invalid — return raw shape + warnings so the wizard can show what
    // was extracted and let the user fix the gaps before save.
    return NextResponse.json({ candidate: result.raw, warnings: result.warnings }, { status: 200 });
  }

  return NextResponse.json({ candidate: result.profile });
}
