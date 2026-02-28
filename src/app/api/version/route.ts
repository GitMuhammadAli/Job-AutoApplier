import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.NEXT_BUILD_ID ||
  Date.now().toString();

export function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
