import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN, GENERIC } from "@/lib/messages";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
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
          { error: GENERIC.UNKNOWN_ACTION },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("[AdminUserAction]", error);
    return NextResponse.json(
      { error: ADMIN.ACTION_FAILED },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.$transaction([
      prisma.activity.deleteMany({ where: { userId: id } }),
      prisma.jobApplication.deleteMany({ where: { userId: id } }),
      prisma.userJob.deleteMany({ where: { userId: id } }),
      prisma.resume.deleteMany({ where: { userId: id } }),
      prisma.emailTemplate.deleteMany({ where: { userId: id } }),
      prisma.userFeedback.deleteMany({ where: { userId: id } }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.account.deleteMany({ where: { userId: id } }),
      prisma.userSettings.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AdminDeleteUser]", error);
    return NextResponse.json(
      { error: ADMIN.DELETE_FAILED },
      { status: 500 }
    );
  }
}
