import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { extractText } from "@/lib/resume-parser";
import { parseResume } from "@/lib/skill-extractor";
import { RESUMES, RESUME_UPLOAD, VALIDATION } from "@/lib/messages";

export const dynamic = "force-dynamic";

const MAX_RESUMES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_STORAGE = 20 * 1024 * 1024; // 20 MB per user

// Tag returned errors with a stable code so the client UI can distinguish
// "fix your file" from "server is broken, please report" — and so when this
// fails in prod we can grep the logs for the exact stage that failed.
type UploadErrorCode =
  | "BLOB_TOKEN_MISSING"
  | "BLOB_LIMIT_CHECK_FAILED"
  | "BLOB_PUT_FAILED"
  | "BAD_FORM_DATA"
  | "PDF_PARSE_FAILED"
  | "DB_WRITE_FAILED";

function fail(code: UploadErrorCode, userMessage: string, status: number, debug?: unknown) {
  if (debug !== undefined) {
    console.error(`[resumes.upload] ${code}:`, debug instanceof Error ? debug.message : debug);
  } else {
    console.error(`[resumes.upload] ${code}`);
  }
  return NextResponse.json({ error: userMessage, code }, { status });
}

export async function POST(req: NextRequest) {
  const __auth = await requireAuthUserId();
  if (__auth.response) return __auth.response;
  const { userId } = __auth;

  // Hard precondition: storage provider must be configured. Without this
  // token, @vercel/blob's `put()` throws a confusing error deep in the call.
  // We'd rather tell the user (and ourselves) immediately — but keep the
  // user-facing copy calm + plain.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail("BLOB_TOKEN_MISSING", RESUME_UPLOAD.BLOB_TOKEN_MISSING, 503);
  }

  // Storage limit check — non-fatal if the blob API can't be reached, but we
  // log it. Previously we silently swallowed; that masked outages.
  try {
    const blobs = await list({ prefix: `resumes/${userId}/` });
    const totalSize = blobs.blobs.reduce((acc, b) => acc + b.size, 0);
    if (totalSize >= MAX_TOTAL_STORAGE) {
      return NextResponse.json({ error: RESUMES.STORAGE_LIMIT }, { status: 400 });
    }
  } catch (err) {
    console.warn(
      `[resumes.upload] BLOB_LIMIT_CHECK_FAILED (continuing):`,
      err instanceof Error ? err.message : err,
    );
  }

  const existingCount = await prisma.resume.count({
    where: { userId, isDeleted: false },
  });
  if (existingCount >= MAX_RESUMES) {
    return NextResponse.json({ error: RESUMES.MAX_ALLOWED(MAX_RESUMES) }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return fail("BAD_FORM_DATA", RESUME_UPLOAD.BAD_FORM_DATA, 400, err);
  }

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) || "Untitled Resume";
  const targetCategoriesRaw = formData.get("targetCategories") as string | null;
  const isDefaultStr = formData.get("isDefault") as string | null;

  if (!file) {
    return NextResponse.json({ error: VALIDATION.NO_FILE_PROVIDED }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: RESUMES.FILE_TOO_LARGE }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: RESUMES.PDF_ONLY }, { status: 400 });
  }

  const targetCategories: string[] = targetCategoriesRaw
    ? (() => {
        try {
          const parsed = JSON.parse(targetCategoriesRaw);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
        } catch {
          return [];
        }
      })()
    : [];

  const isDefault = isDefaultStr === "true";
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name;
  const fileType = file.type;

  // PDF text extraction is best-effort: the parser already swallows internal
  // errors and returns `quality: "empty"`. Failing the whole upload here would
  // block users with image-only PDFs from saving at all — they can paste text
  // manually after.
  const ext = fileName.split(".").pop()?.toLowerCase() || "pdf";
  let textContent = "";
  let textQuality: "good" | "poor" | "empty" = "empty";
  let detectedSkills: string[] = [];
  try {
    const extracted = await extractText(buffer, ext);
    textContent = extracted.text;
    textQuality = extracted.quality;
    detectedSkills = parseResume(textContent).skills;
  } catch (err) {
    console.warn(
      `[resumes.upload] PDF_PARSE_FAILED (continuing with empty text):`,
      err instanceof Error ? err.message : err,
    );
  }

  // Blob upload — this is the most common point of failure (token, network,
  // size). Catch separately so the error message is actionable.
  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(`resumes/${userId}/${fileName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The Vercel Blob SDK throws this exact phrase when token is invalid/missing.
    if (/access token|unauthorized|forbidden/i.test(msg)) {
      return fail("BLOB_TOKEN_MISSING", RESUME_UPLOAD.BLOB_TOKEN_MISSING, 503, err);
    }
    return fail("BLOB_PUT_FAILED", RESUME_UPLOAD.BLOB_PUT_FAILED, 502, err);
  }

  const resumeData = {
    userId,
    name: name.trim(),
    fileName,
    fileUrl: blob.url,
    fileType,
    content: textContent || null,
    textQuality,
    targetCategories,
    detectedSkills,
    isDefault,
  };

  let resume;
  try {
    if (isDefault) {
      const [, created] = await prisma.$transaction([
        prisma.resume.updateMany({
          where: { userId, isDeleted: false },
          data: { isDefault: false },
        }),
        prisma.resume.create({ data: resumeData }),
      ]);
      resume = created;
    } else {
      resume = await prisma.resume.create({ data: resumeData });
    }
  } catch (err) {
    // Blob succeeded but DB write failed — the file is sitting in Vercel Blob
    // storage with no row pointing at it. Best-effort delete to avoid orphaned
    // blobs racking up cost. We swallow the cleanup error because the user
    // already gets the DB error toast; logging it is enough.
    del(blob.url).catch((cleanupErr) => {
      console.error(
        `[upload] Failed to delete orphaned blob ${blob.url} after DB write failure:`,
        cleanupErr,
      );
    });
    return fail("DB_WRITE_FAILED", RESUME_UPLOAD.DB_WRITE_FAILED, 500, err);
  }

  const needsManualText = textQuality === "poor" || textQuality === "empty";

  return NextResponse.json({
    success: true,
    resume: {
      id: resume.id,
      name: resume.name,
      fileName: resume.fileName,
      fileUrl: resume.fileUrl,
      fileType: resume.fileType,
      textQuality: resume.textQuality,
      targetCategories: resume.targetCategories,
      detectedSkills: resume.detectedSkills,
      isDefault: resume.isDefault,
    },
    textQuality,
    needsManualText,
  });
}
