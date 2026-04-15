import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { generateApplication } from "@/app/actions/application-email";
import { checkRateLimit } from "@/lib/rate-limit";
import { APPLICATIONS, GENERIC, RATE_LIMIT, VALIDATION } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const rateCheck = checkRateLimit(userId, "application-generate");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: RATE_LIMIT.TOO_MANY_REQUESTS_WAIT },
        { status: 429 }
      );
    }
    const { userJobId } = await req.json();

    if (!userJobId) {
      return NextResponse.json(
        { error: VALIDATION.USER_JOB_ID_REQUIRED },
        { status: 400 }
      );
    }

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
