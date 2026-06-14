import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN } from "@/lib/messages";
import { parseBody } from "@/lib/validation/parse-body";

export const dynamic = "force-dynamic";

const PatchFeedbackBody = z.object({
  id: z.string().trim().min(20).max(40),
  // Values mirror the admin UI buttons in /admin/feedback/page.tsx.
  status: z.enum(["new", "reviewed", "resolved", "dismissed"]),
  // Allow empty string to clear the note, max 2KB to keep admin form sane.
  adminNote: z.string().max(2048).optional(),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const type = req.nextUrl.searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (type && type !== "all") where.type = type;

  const feedback = await prisma.userFeedback.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ feedback });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
  }

  const parsed = await parseBody(req, PatchFeedbackBody);
  if (!parsed.ok) return parsed.response;
  const { id, status, adminNote } = parsed.data;

  const data: Record<string, unknown> = { status };
  if (adminNote !== undefined) data.adminNote = adminNote || null;

  await prisma.userFeedback.update({ where: { id }, data });

  return NextResponse.json({ success: true });
}
