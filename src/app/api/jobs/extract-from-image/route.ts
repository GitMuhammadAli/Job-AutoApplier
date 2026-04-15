import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { extractJDFromImage } from "@/lib/ai/extract-jd-from-image";
import { GENERIC, JOBS, VALIDATION } from "@/lib/messages";

export const maxDuration = 30;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  // Auth check
  try {
    await getAuthUserId();
  } catch {
    return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: GENERIC.INVALID_FORM_DATA },
      { status: 400 }
    );
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: VALIDATION.IMAGE_FIELD_REQUIRED },
      { status: 400 }
    );
  }

  // Validate MIME type
  const mimeType = file.type;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      {
        error: JOBS.IMAGE_TYPE_INVALID(mimeType),
      },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: JOBS.IMAGE_TOO_LARGE },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const extracted = await extractJDFromImage(imageBuffer, mimeType);

    return NextResponse.json(extracted);
  } catch (err) {
    console.error("[extract-from-image] Error:", err);
    const message =
      err instanceof Error ? err.message : JOBS.EXTRACT_IMAGE_FAILED;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
