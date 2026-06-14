import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERIC, PUSH } from "@/lib/messages";
import { parseBody } from "@/lib/validation/parse-body";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

// Mirrors the Web Push PushSubscriptionJSON shape — endpoint URL is the
// push service's, p256dh + auth are b64url-encoded keys.
const SubscribeBody = z.object({
  endpoint: z.string().trim().url().max(2048),
  keys: z.object({
    p256dh: z.string().trim().min(20).max(256),
    auth: z.string().trim().min(10).max(64),
  }),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().trim().url().max(2048).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }

    const parsed = await parseBody(req, SubscribeBody);
    if (!parsed.ok) return parsed.response;
    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: session.user.id,
          endpoint,
        },
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers.get("user-agent") || undefined,
      },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: { pushNotifications: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await captureError(error, { route: "POST /api/push/subscribe" });
    return NextResponse.json(
      { error: PUSH.FAILED_SAVE_SUBSCRIPTION },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }

    const parsed = await parseBody(req, UnsubscribeBody);
    if (!parsed.ok) return parsed.response;
    const { endpoint } = parsed.data;

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: session.user.id, endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { userId: session.user.id },
      });
    }

    const remaining = await prisma.pushSubscription.count({
      where: { userId: session.user.id },
    });

    if (remaining === 0) {
      await prisma.userSettings.update({
        where: { userId: session.user.id },
        data: { pushNotifications: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    await captureError(error, { route: "DELETE /api/push/subscribe" });
    return NextResponse.json(
      { error: PUSH.FAILED_REMOVE_SUBSCRIPTION },
      { status: 500 },
    );
  }
}
