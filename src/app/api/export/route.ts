import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSettingsFields } from "@/lib/encryption";
import { LIMITS } from "@/lib/constants";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const [rawSettings, jobs, applications, resumes, activities, templates] =
      await Promise.all([
        prisma.userSettings.findUnique({ where: { userId } }),
        prisma.userJob.findMany({
          where: { userId },
          include: { globalJob: true },
          take: LIMITS.EXPORT_JOBS,
        }),
        prisma.jobApplication.findMany({ where: { userId }, take: LIMITS.EXPORT_APPLICATIONS }),
        prisma.resume.findMany({ where: { userId }, take: LIMITS.EXPORT_RESUMES }),
        prisma.activity.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: LIMITS.ANALYTICS_MAX_ROWS,
        }),
        prisma.emailTemplate.findMany({ where: { userId }, take: 100 }),
      ]);
    const settings = rawSettings ? decryptSettingsFields(rawSettings) : null;

    const zip = new JSZip();

    // Settings JSON (strip sensitive fields)
    if (settings) {
      const safeSettings = { ...settings, smtpPass: undefined };
      zip.file("settings.json", JSON.stringify(safeSettings, null, 2));
    }

    // Jobs CSV
    const jobsCsv = [
      "Title,Company,Location,Source,Score,Stage,Category,Skills,Created",
      ...jobs.map((j) =>
        [
          escapeCsv(j.globalJob.title),
          escapeCsv(j.globalJob.company),
          escapeCsv(j.globalJob.location || ""),
          escapeCsv(j.globalJob.source),
          String(j.matchScore || 0),
          escapeCsv(j.stage),
          escapeCsv(j.globalJob.category || ""),
          escapeCsv((j.globalJob.skills ?? []).join("; ")),
          j.createdAt.toISOString(),
        ].join(","),
      ),
    ].join("\n");
    zip.file("jobs.csv", jobsCsv);

    // Applications CSV
    const appsCsv = [
      "Status,Recipient,Subject,Via,SentAt,Created",
      ...applications.map((a) =>
        [
          escapeCsv(a.status),
          escapeCsv(a.recipientEmail),
          escapeCsv(a.subject),
          escapeCsv(a.appliedVia || ""),
          a.sentAt?.toISOString() || "",
          a.createdAt.toISOString(),
        ].join(","),
      ),
    ].join("\n");
    zip.file("applications.csv", appsCsv);

    // Resumes metadata CSV
    const resumesCsv = [
      "Name,FileName,Categories,Skills,Quality,IsDefault,Created",
      ...resumes.map((r) =>
        [
          escapeCsv(r.name),
          escapeCsv(r.fileName || ""),
          escapeCsv((r.targetCategories ?? []).join("; ")),
          escapeCsv((r.detectedSkills ?? []).join("; ")),
          escapeCsv(r.textQuality || ""),
          String(r.isDefault),
          r.createdAt.toISOString(),
        ].join(","),
      ),
    ].join("\n");
    zip.file("resumes.csv", resumesCsv);

    // Activity log CSV
    const activityCsv = [
      "Type,Description,Created",
      ...activities.map((a) =>
        [
          escapeCsv(a.type),
          escapeCsv(a.description || ""),
          a.createdAt.toISOString(),
        ].join(","),
      ),
    ].join("\n");
    zip.file("activity_log.csv", activityCsv);

    // Templates JSON
    zip.file("templates.json", JSON.stringify(templates, null, 2));

    // Download resume files from Blob
    const resumeFolder = zip.folder("resume_files");
    for (const resume of resumes.filter((r) => !r.isDeleted && r.fileUrl)) {
      try {
        const response = await fetch(resume.fileUrl!);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          resumeFolder!.file(resume.fileName || `${resume.name}.pdf`, buffer);
        }
      } catch {
        // Skip failed downloads
      }
    }

    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const dateStr = new Date().toISOString().split("T")[0];

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="jobpilot-export-${dateStr}.zip"`,
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
