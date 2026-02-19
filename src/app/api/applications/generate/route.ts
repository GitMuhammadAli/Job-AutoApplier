import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { generateApplication } from "@/app/actions/application-email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await getAuthUserId();
    const { userJobId } = await req.json();

    if (!userJobId) {
      return NextResponse.json(
        { error: "userJobId required" },
        { status: 400 }
      );
    }

    const result = await generateApplication(userJobId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
