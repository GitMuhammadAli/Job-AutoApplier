import { NextResponse } from "next/server";
import { PUSH } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { error: PUSH.NOT_CONFIGURED },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey: key });
}
