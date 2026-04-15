import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }

    const body = await req.json();
    const { action, olderThanDays } = body as { action: string; olderThanDays?: number };

    if (action === "clear-inactive") {
      const result = await prisma.globalJob.updateMany({
        where: { isActive: false },
        data: { isActive: false },
      });
      const deleted = await prisma.globalJob.deleteMany({
        where: {
          isActive: false,
          userJobs: { none: {} },
        },
      });
      return NextResponse.json({ success: true, count: deleted.count, message: ADMIN.DELETED_INACTIVE_JOBS(deleted.count) });
    }

    if (action === "clear-old" && olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const result = await prisma.globalJob.updateMany({
        where: { isActive: true, lastSeenAt: { lt: cutoff } },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, count: result.count, message: ADMIN.DEACTIVATED_STALE_JOBS(result.count, olderThanDays) });
    }

    if (action === "clear-no-email") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.globalJob.updateMany({
        where: { isActive: true, companyEmail: null, createdAt: { lt: cutoff }, userJobs: { none: {} } },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, count: result.count, message: ADMIN.DEACTIVATED_NO_EMAIL_JOBS(result.count) });
    }

    return NextResponse.json({ error: GENERIC.INVALID_ACTION }, { status: 400 });
  } catch (error) {
    console.error("[admin/jobs DELETE]", error);
    return NextResponse.json({ error: GENERIC.INTERNAL_ERROR }, { status: 500 });
  }
}
