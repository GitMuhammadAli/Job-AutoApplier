/**
 * GET/POST /api/email/unsubscribe?app=<applicationId>
 *
 * Endpoint for the List-Unsubscribe header (RFC 2369) and the
 * List-Unsubscribe-Post one-click variant (RFC 8058). Gmail, Yahoo, and
 * Outlook all surface a one-click "Unsubscribe" button at the top of
 * messages from senders that ship this header — clicking it POSTs here.
 *
 * What it does:
 *   - Looks up the JobApplication by id.
 *   - Adds the recipient to that user's EmailSuppression list with
 *     reason=USER_UNSUBSCRIBE.
 *   - Cancels any pending follow-up so we don't immediately re-send.
 *
 * No auth — that's the whole point. The applicationId is the secret.
 * Cuid v1 is 25 chars of base36, so brute-force enumeration isn't a
 * realistic threat for this endpoint's blast radius (suppresses a
 * single recipient on a single sender's list).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function suppressViaApplication(applicationId: string): Promise<{ ok: boolean; status: number; message: string }> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: { userId: true, recipientEmail: true },
  });
  if (!application) {
    return { ok: false, status: 404, message: "Unknown unsubscribe token." };
  }
  const { userId, recipientEmail } = application;
  if (!recipientEmail) {
    return { ok: false, status: 400, message: "No recipient on this application." };
  }
  const email = recipientEmail.toLowerCase();
  await prisma.emailSuppression.upsert({
    where: { userId_email: { userId, email } },
    update: {
      reason: "USER_UNSUBSCRIBE",
      suppressedAt: new Date(),
      source: "list-unsubscribe-header",
    },
    create: {
      userId,
      email,
      reason: "USER_UNSUBSCRIBE",
      source: "list-unsubscribe-header",
    },
  });

  // Cancel any unsent follow-up draft.
  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { followUpStatus: "CANCELLED" },
  }).catch(() => {});

  return { ok: true, status: 200, message: "You're unsubscribed. We won't email this address again." };
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const applicationId = url.searchParams.get("app");
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application token." }, { status: 400 });
  }
  const result = await suppressViaApplication(applicationId);
  return NextResponse.json({ ok: result.ok, message: result.message }, { status: result.status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const applicationId = url.searchParams.get("app");
  if (!applicationId) {
    return new NextResponse("Missing application token.", { status: 400 });
  }
  const result = await suppressViaApplication(applicationId);
  // Plain HTML confirmation page for human visitors clicking the mailto/link
  // form of the header. Stylelessly minimal so it works without our app shell.
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background:#fafaf7; color:#1c1917; max-width:32rem; margin: 6rem auto; padding: 0 1.5rem; line-height: 1.65; }
  h1 { font-size: 1.5rem; margin-bottom: .5rem; }
  p { color:#57534e; }
</style></head>
<body>
  <h1>${result.ok ? "You're unsubscribed." : "Couldn't unsubscribe."}</h1>
  <p>${result.message}</p>
</body></html>`;
  return new NextResponse(html, {
    status: result.status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
