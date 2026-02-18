import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { extractTextFromPdf, extractSkillsFromResume } from "@/lib/matching/resume-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "Untitled Resume";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;
    const fileName = file.name;

    let textContent = "";
    if (fileType === "application/pdf") {
      textContent = await extractTextFromPdf(buffer);
    } else if (fileType === "text/plain") {
      textContent = buffer.toString("utf-8");
    }

    const skills = extractSkillsFromResume(textContent);

    const resume = await prisma.resume.create({
      data: {
        userId,
        name: name.trim(),
        fileName,
        fileType,
        content: textContent || null,
      },
    });

    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        name: resume.name,
        fileName: resume.fileName,
        hasContent: !!textContent,
        extractedSkills: skills,
      },
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
