import { NextResponse } from "next/server";

const BUILD_ID = Date.now().toString(36);

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID });
}
