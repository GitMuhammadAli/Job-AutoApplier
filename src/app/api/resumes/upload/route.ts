import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { extractText, extractSkillsFromContent } from "@/lib/resume-parser";

export const dynamic = "force-dynamic";

const MAX_RESUMES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();

    const existingCount = await prisma.resume.count({
      where: { userId, isDeleted: false },
    });
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

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, DOCX, and TXT files are supported" },
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
    const detectedSkills = extractSkillsFromContent(textContent);

    const blob = await put(`resumes/${userId}/${fileName}`, buffer, {
      access: "public",
    });

    if (isDefault) {
      await prisma.resume.updateMany({
        where: { userId, isDeleted: false },
        data: { isDefault: false },
      });
    }

    const resume = await prisma.resume.create({
      data: {
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
      },
    });

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
