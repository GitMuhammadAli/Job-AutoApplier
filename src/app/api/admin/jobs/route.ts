import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ success: true, count: deleted.count, message: `Deleted ${deleted.count} inactive jobs with no user links` });
    }

    if (action === "clear-old" && olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const result = await prisma.globalJob.updateMany({
        where: { isActive: true, lastSeenAt: { lt: cutoff } },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, count: result.count, message: `Deactivated ${result.count} jobs not seen in ${olderThanDays} days` });
    }

    if (action === "clear-no-email") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.globalJob.updateMany({
        where: { isActive: true, companyEmail: null, createdAt: { lt: cutoff }, userJobs: { none: {} } },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, count: result.count, message: `Deactivated ${result.count} old jobs without emails` });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[admin/jobs DELETE]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
