import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { extractTextFromPDF, extractSkillsFromContent } from "@/lib/resume-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "Untitled Resume";
    const targetCategoriesRaw = formData.get("targetCategories") as string | null;
    const isDefaultStr = formData.get("isDefault") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
    const fileType = file.type;
    const fileName = file.name;

    let textContent = "";
    let textQuality: "good" | "poor" | "empty" = "good";
    if (fileType === "application/pdf") {
      const result = await extractTextFromPDF(buffer);
      textContent = result.text;
      textQuality = result.quality;
    } else if (fileType === "text/plain") {
      textContent = buffer.toString("utf-8");
    }

    const detectedSkills = extractSkillsFromContent(textContent);

    const blob = await put(`resumes/${userId}/${fileName}`, buffer, {
      access: "public",
    });

    if (isDefault) {
      await prisma.resume.updateMany({
        where: { userId },
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
        content: resume.content,
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
