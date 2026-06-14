import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUserId } from "@/lib/auth";
import { generateApplication } from "@/app/actions/application-email";
import { checkRateLimit } from "@/lib/rate-limit";
import { APPLICATIONS, GENERIC, RATE_LIMIT } from "@/lib/messages";
import { parseBody } from "@/lib/validation/parse-body";

export const dynamic = "force-dynamic";

const GenerateApplicationBody = z.object({
  userJobId: z.string().trim().min(20).max(40),
});

export async function POST(req: NextRequest) {
  try {
    const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;
    const rateCheck = checkRateLimit(userId, "application-generate");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: RATE_LIMIT.TOO_MANY_REQUESTS_WAIT },
        { status: 429 }
      );
    }
    const parsed = await parseBody(req, GenerateApplicationBody);
    if (!parsed.ok) return parsed.response;
    const { userJobId } = parsed.data;

    const result = await generateApplication(userJobId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : APPLICATIONS.GENERATION_FAILED;
    if (message === GENERIC.NOT_AUTHENTICATED) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
