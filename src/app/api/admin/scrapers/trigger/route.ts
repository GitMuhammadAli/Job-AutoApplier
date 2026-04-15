import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ADMIN } from "@/lib/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const VALID_SCRAPE_SOURCES = [
  "indeed", "remotive", "arbeitnow", "rozee", "linkedin",
  "linkedin_posts", "jsearch", "adzuna", "google",
];

const VALID_CRON_ACTIONS = [
  "instant-apply", "match-jobs", "match-all-users",
  "send-scheduled", "send-queued", "notify-matches",
  "cleanup-stale", "follow-up", "check-follow-ups",
  "scrape-global", "backfill-emails",
];

function cronPath(action: string): string {
  switch (action) {
    case "scrape-global": return "/api/cron/scrape-global";
    case "instant-apply": return "/api/cron/instant-apply";
    case "match-jobs": return "/api/cron/match-jobs";
    case "match-all-users": return "/api/cron/match-all-users";
    case "send-scheduled": return "/api/cron/send-scheduled";
    case "send-queued": return "/api/cron/send-queued";
    case "notify-matches": return "/api/cron/notify-matches";
    case "cleanup-stale": return "/api/cron/cleanup-stale";
    case "follow-up": return "/api/cron/follow-up";
    case "check-follow-ups": return "/api/cron/check-follow-ups";
    default: return "";
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const source = (body.source as string) || "all";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return NextResponse.json(
      { error: ADMIN.APP_URL_NOT_CONFIGURED },
      { status: 500 },
    );
  }

  if (!secret) {
    return NextResponse.json(
      { error: ADMIN.CRON_SECRET_NOT_CONFIGURED },
      { status: 500 },
    );
  }

  // Backfill emails — direct POST to admin route (not a cron)
  if (source === "backfill-emails") {
    try {
      const res = await fetch(`${baseUrl}/api/admin/backfill-emails`, {
        method: "POST",
        headers: { cookie: req.headers.get("cookie") || "" },
      });
      const data = await res.json().catch(() => ({ status: res.status }));
      return NextResponse.json({ action: source, status: res.status, ...data });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: ADMIN.BACKFILL_FAILED, details: String(err) },
        { status: 500 },
      );
    }
  }

  // Trigger a cron action
  if (VALID_CRON_ACTIONS.includes(source)) {
    const path = cronPath(source);
    if (!path) {
      return NextResponse.json({ error: ADMIN.UNKNOWN_ACTION_NAMED(source) }, { status: 400 });
    }
    try {
      const res = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${secret}` } });
      const data = await res.json().catch(() => ({ status: res.status }));
      return NextResponse.json({ action: source, status: res.status, ...data });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: ADMIN.TRIGGER_FAILED(source), details: String(err) },
        { status: 500 },
      );
    }
  }

  // Scrape all sources
  if (source === "all") {
    const results: { source: string; status: number | string; error?: string }[] = [];
    for (const s of VALID_SCRAPE_SOURCES) {
      try {
        const res = await fetch(`${baseUrl}/api/cron/scrape/${s}`, { headers: { authorization: `Bearer ${secret}` } });
        results.push({ source: s, status: res.status });
      } catch (err: unknown) {
        results.push({ source: s, status: "error", error: String(err) });
      }
    }
    return NextResponse.json({ results });
  }

  // Scrape single source
  if (VALID_SCRAPE_SOURCES.includes(source)) {
    try {
      const res = await fetch(`${baseUrl}/api/cron/scrape/${source}`, { headers: { authorization: `Bearer ${secret}` } });
      const data = await res.json().catch(() => ({ status: res.status }));
      return NextResponse.json(data);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: ADMIN.TRIGGER_FAILED(source), details: String(err) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: ADMIN.UNKNOWN_SOURCE(source) }, { status: 400 });
}
