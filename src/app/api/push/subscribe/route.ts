import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERIC, PUSH, VALIDATION } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_SUBSCRIPTION },
        { status: 400 },
      );
    }

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
    console.error("[Push Subscribe]", error);
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

    const body = await req.json();
    const { endpoint } = body;

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
    console.error("[Push Unsubscribe]", error);
    return NextResponse.json(
      { error: PUSH.FAILED_REMOVE_SUBSCRIPTION },
      { status: 500 },
    );
  }
}
