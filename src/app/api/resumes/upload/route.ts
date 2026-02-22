import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { extractText } from "@/lib/resume-parser";
import { parseResume } from "@/lib/skill-extractor";

export const dynamic = "force-dynamic";

const MAX_RESUMES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_STORAGE = 20 * 1024 * 1024; // 20 MB per user

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();

    const existingCount = await prisma.resume.count({
      where: { userId, isDeleted: false },
    });

    // 20 MB total storage check
    try {
      const blobs = await list({ prefix: `resumes/${userId}/` });
      const totalSize = blobs.blobs.reduce((acc, b) => acc + b.size, 0);
      if (totalSize >= MAX_TOTAL_STORAGE) {
        return NextResponse.json(
          { error: "Storage limit reached (20 MB). Delete a resume first." },
          { status: 400 }
        );
      }
    } catch {
      // Blob list may fail in dev — continue
    }
    if (existingCount >= MAX_RESUMES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_RESUMES} resumes allowed. Delete one first.` },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "Untitled Resume";
    const targetCategoriesRaw = formData.get("targetCategories") as string | null;
    const isDefaultStr = formData.get("isDefault") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 5 MB" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported. Please convert your resume to PDF first." },
        { status: 400 }
      );
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

    const ext = fileName.split(".").pop()?.toLowerCase() || "pdf";
    const { text: textContent, quality: textQuality } = await extractText(buffer, ext);
    const parsed = parseResume(textContent);
    const detectedSkills = parsed.skills;

    const blob = await put(`resumes/${userId}/${fileName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
    });

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
  } catch (error) {
    console.error("Resume upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
