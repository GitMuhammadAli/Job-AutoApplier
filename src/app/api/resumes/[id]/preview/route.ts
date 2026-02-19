import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthUserId();
    const resume = await prisma.resume.findFirst({
      where: { id: params.id, userId, isDeleted: false },
      select: { fileUrl: true, fileName: true, fileType: true },
    });

    if (!resume?.fileUrl) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const blobResponse = await fetch(resume.fileUrl);
    if (!blobResponse.ok) {
      return NextResponse.json({ error: "File unavailable" }, { status: 502 });
    }

    const contentType =
      resume.fileType || blobResponse.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(blobResponse.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${resume.fileName || "resume"}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
