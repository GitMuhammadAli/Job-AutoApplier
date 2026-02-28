import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

let cachedBuildId: string | null = null;

function getBuildId(): string {
  if (cachedBuildId) return cachedBuildId;

  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    cachedBuildId = fs.readFileSync(buildIdPath, "utf-8").trim();
    return cachedBuildId;
  } catch {
    // Fallback to env vars
  }

  cachedBuildId =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.NEXT_BUILD_ID ||
    "unknown";

  return cachedBuildId;
}

export function GET() {
  return NextResponse.json(
    { buildId: getBuildId() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
