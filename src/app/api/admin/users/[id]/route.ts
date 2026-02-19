import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  try {
    switch (action) {
      case "pause":
        await prisma.userSettings.update({
          where: { userId: id },
          data: { accountStatus: "paused" },
        });
        break;

      case "activate":
        await prisma.userSettings.update({
          where: { userId: id },
          data: { accountStatus: "active", sendingPausedUntil: null },
        });
        break;

      case "reset_sending":
        await prisma.userSettings.update({
          where: { userId: id },
          data: { sendingPausedUntil: null },
        });
        break;

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("[AdminUserAction]", error);
    return NextResponse.json(
      { error: "Action failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.activity.deleteMany({ where: { userId: id } });
    await prisma.jobApplication.deleteMany({ where: { userId: id } });
    await prisma.userJob.deleteMany({ where: { userId: id } });
    await prisma.resume.deleteMany({ where: { userId: id } });
    await prisma.emailTemplate.deleteMany({ where: { userId: id } });
    await prisma.userSettings
      .delete({ where: { userId: id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AdminDeleteUser]", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
