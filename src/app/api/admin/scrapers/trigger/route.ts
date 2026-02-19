import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const source = (body.source as string) || "all";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (source === "instant-apply") {
    try {
      const res = await fetch(
        `${baseUrl}/api/cron/instant-apply?secret=${secret}`
      );
      const data = await res.json();
      return NextResponse.json(data);
    } catch (err: unknown) {
      return NextResponse.json(
        {
          error: "Instant apply trigger failed",
          details: String(err),
        },
        { status: 500 }
      );
    }
  }

  if (source === "all") {
    const sources = [
      "indeed",
      "remotive",
      "arbeitnow",
      "rozee",
      "linkedin",
    ];
    const results: {
      source: string;
      status: number | string;
      error?: string;
    }[] = [];

    for (const s of sources) {
      try {
        const res = await fetch(
          `${baseUrl}/api/cron/scrape/${s}?secret=${secret}`
        );
        results.push({ source: s, status: res.status });
      } catch (err: unknown) {
        results.push({
          source: s,
          status: "error",
          error: String(err),
        });
      }
    }
    return NextResponse.json({ results });
  }

  try {
    const res = await fetch(
      `${baseUrl}/api/cron/scrape/${source}?secret=${secret}`
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: `Trigger failed for ${source}`,
        details: String(err),
      },
      { status: 500 }
    );
  }
}
