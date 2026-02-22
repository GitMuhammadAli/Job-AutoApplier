"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseResume } from "@/lib/skill-extractor";
import { extractText } from "@/lib/resume-parser";
import { generateWithGroq } from "@/lib/groq";
import { z } from "zod";
import { LIMITS } from "@/lib/constants";

const resumeNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(200, "Name too long");

export async function getResumeCount(): Promise<number> {
  try {
    const userId = await getAuthUserId();
    return prisma.resume.count({ where: { userId, isDeleted: false } });
  } catch (error) {
    console.error("[getResumeCount]", error);
    return 0;
  }
}

export async function getResumesWithStats() {
  try {
    const userId = await getAuthUserId();

    const resumes = await prisma.resume.findMany({
      where: { userId, isDeleted: false },
      include: {
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMITS.RESUMES_PER_PAGE,
    });

    return resumes.map((r) => ({
      id: r.id,
      name: r.name,
      fileName: r.fileName,
      fileUrl: r.fileUrl,
      fileType: r.fileType,
      content: r.content,
      isDefault: r.isDefault,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      applicationCount: r._count.applications,
      targetCategories: r.targetCategories,
    }));
  } catch (error) {
    console.error("[getResumesWithStats]", error);
    throw new Error("Failed to load resumes");
  }
}

export async function createResume(
  name: string,
  fileUrl?: string,
  content?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const cleanName = resumeNameSchema.parse(name.trim());

    if (fileUrl && fileUrl.length > 2000) return { success: false, error: "File URL too long" };

    await prisma.resume.create({
      data: {
        name: cleanName,
        fileUrl: fileUrl || null,
        content: content || null,
        userId,
      },
    });

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: error.errors[0].message };
    console.error("[createResume] Error:", error);
    return { success: false, error: "Failed to create resume" };
  }
}

export async function updateResume(
  id: string,
  data: {
    name?: string;
    fileUrl?: string;
    content?: string;
    isDefault?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    if (data.name !== undefined) resumeNameSchema.parse(data.name.trim());

    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) return { success: false, error: "Resume not found" };

    const updateData = {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl || null }),
      ...(data.content !== undefined && { content: data.content || null }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    };

    if (data.isDefault) {
      await prisma.$transaction([
        prisma.resume.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.resume.update({ where: { id }, data: updateData }),
      ]);
    } else {
      await prisma.resume.update({ where: { id }, data: updateData });
    }

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: error.errors[0].message };
    console.error("[updateResume] Error:", error);
    return { success: false, error: "Failed to update resume" };
  }
}

export async function deleteResume(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) return { success: false, error: "Resume not found" };

    if (resume.isDefault) {
      const otherResumes = await prisma.resume.count({
        where: { userId, isDeleted: false, id: { not: id } },
      });
      if (otherResumes === 0) {
        return { success: false, error: "Cannot delete your only resume. Upload another first." };
      }
      await prisma.$transaction([
        prisma.resume.update({
          where: { id },
          data: { isDeleted: true, deletedAt: new Date(), isDefault: false },
        }),
        prisma.resume.updateMany({
          where: { userId, isDeleted: false, id: { not: id } },
          data: { isDefault: true },
        }),
      ]);
    } else {
      await prisma.resume.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    console.error("[deleteResume] Error:", error);
    return { success: false, error: "Failed to delete resume" };
  }
}

export async function updateResumeText(resumeId: string, content: string): Promise<{ success: boolean; detectedSkills?: string[]; error?: string }> {
  try {
    const userId = await getAuthUserId();

    if (content.length > LIMITS.MAX_RESUME_CONTENT) {
      return { success: false, error: `Resume content must be ${LIMITS.MAX_RESUME_CONTENT.toLocaleString()} characters or less` };
    }

    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId, isDeleted: false },
    });
    if (!resume) return { success: false, error: "Resume not found" };

    const parsed = parseResume(content);

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        content: content || null,
        detectedSkills: parsed.skills,
        textQuality:
          content.split(/\s+/).filter((w) => w.length > 0).length >= 50
            ? "good"
            : "poor",
      },
    });

    revalidatePath("/resumes");
    return { success: true, detectedSkills: parsed.skills };
  } catch (error) {
    console.error("[updateResumeText] Error:", error);
    return { success: false, error: "Failed to update resume content." };
  }
}

export async function updateResumeCategories(
  resumeId: string,
  targetCategories: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    if (!Array.isArray(targetCategories) || targetCategories.length > 30) {
      return { success: false, error: "Target categories must be an array with at most 30 items" };
    }
    if (targetCategories.some((c) => typeof c !== "string" || c.length > 100)) {
      return { success: false, error: "Each category must be a string of at most 100 characters" };
    }

    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId, isDeleted: false },
    });
    if (!resume) return { success: false, error: "Resume not found" };

    await prisma.resume.update({
      where: { id: resumeId },
      data: { targetCategories },
    });

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    console.error("[updateResumeCategories] Error:", error);
    return { success: false, error: "Failed to update resume categories." };
  }
}

export async function reExtractResume(resumeId: string): Promise<{
  success: boolean;
  detectedSkills?: string[];
  contentLength?: number;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();

    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId, isDeleted: false },
    });
    if (!resume) return { success: false, error: "Resume not found" };
    if (!resume.fileUrl) return { success: false, error: "No file URL — please re-upload or paste content manually" };

    let response: Response;
    try {
      response = await fetch(resume.fileUrl);
    } catch (fetchErr) {
      console.error("[reExtractResume] fetch error:", fetchErr);
      return { success: false, error: "Could not download file from storage. Please re-upload your resume." };
    }
    if (!response.ok) return { success: false, error: `Could not download file (HTTP ${response.status}). Please re-upload your resume.` };

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length < 100) {
      return { success: false, error: `Downloaded file is too small (${buffer.length} bytes). The file may be corrupted. Please re-upload.` };
    }

    const ext = resume.fileName?.split(".").pop()?.toLowerCase() || "pdf";
    const { text, quality } = await extractText(buffer, ext);

    if (!text || text.length < 10) {
      return {
        success: false,
        error: `Could not extract text from this PDF. This usually happens with PDFs made in design tools (Canva, Figma) or some LaTeX templates. Try: 1) Re-upload the PDF, or 2) Open the PDF → Select All → Copy → use "Paste Resume" to paste the text manually.`,
      };
    }

    const parsed = parseResume(text);

    await prisma.resume.update({
      where: { id: resumeId },
      data: { content: text, textQuality: quality, detectedSkills: parsed.skills },
    });

    revalidatePath("/resumes");
    return { success: true, detectedSkills: parsed.skills, contentLength: text.length };
  } catch (error) {
    console.error("[reExtractResume] Error:", error);
    return { success: false, error: "Failed to re-extract resume content. Please try re-uploading or pasting text manually." };
  }
}

export async function setDefaultResume(resumeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId, isDeleted: false },
    });
    if (!resume) return { success: false, error: "Resume not found" };

    await prisma.$transaction([
      prisma.resume.updateMany({
        where: { userId, isDeleted: false },
        data: { isDefault: false },
      }),
      prisma.resume.update({
        where: { id: resumeId },
        data: { isDefault: true },
      }),
    ]);

    revalidatePath("/resumes");
    return { success: true };
  } catch (error) {
    console.error("[setDefaultResume] Error:", error);
    return { success: false, error: "Failed to set default resume." };
  }
}

export async function rephraseResumeContent(
  resumeId: string
): Promise<{ success: boolean; content?: string; detectedSkills?: string[]; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId, isDeleted: false },
    });
    if (!resume) return { success: false, error: "Resume not found" };
    if (!resume.content || resume.content.trim().length < 50) {
      return { success: false, error: "Resume needs content first. Paste your resume text or upload a PDF, then rephrase." };
    }

    const settings = await prisma.userSettings.findUnique({ where: { userId } });

    const systemPrompt = `You are an expert resume writer. Rephrase and improve the given resume text to be more impactful, professional, and ATS-friendly.

RULES:
- Keep ALL factual information (dates, companies, degrees, skills, projects) exactly the same — do NOT invent or remove anything
- Improve phrasing: use strong action verbs, quantify achievements where possible, remove filler words
- Keep the same overall structure and sections (Experience, Skills, Education, etc.)
- Make bullet points concise and results-oriented
- Preserve all technical skills and keywords — they are critical for ATS matching
- Output ONLY the rephrased resume text, no explanations or commentary
- Keep a similar length — do not drastically shorten or lengthen the content
- Use professional, confident language without being arrogant`;

    const userPrompt = `Here is the resume text to rephrase and improve:\n\n${resume.content.slice(0, 8000)}${
      settings?.fullName ? `\n\nCandidate name: ${settings.fullName}` : ""
    }`;

    const rephrased = await generateWithGroq(systemPrompt, userPrompt, {
      temperature: 0.5,
      max_tokens: 2000,
    });

    if (!rephrased || rephrased.trim().length < 50) {
      return { success: false, error: "AI returned an unusable result. Try again." };
    }

    const parsed = parseResume(rephrased.trim());

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        content: rephrased.trim(),
        detectedSkills: parsed.skills,
        textQuality:
          rephrased.split(/\s+/).filter((w) => w.length > 0).length >= 50
            ? "good"
            : "poor",
      },
    });

    revalidatePath("/resumes");
    return { success: true, content: rephrased.trim(), detectedSkills: parsed.skills };
  } catch (error) {
    console.error("[rephraseResumeContent] Error:", error);
    return { success: false, error: "Failed to rephrase resume. Please try again." };
  }
}
