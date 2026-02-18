import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const [userJobs, applications, resumes, settings, activities] = await Promise.all([
      prisma.userJob.findMany({
        where: { userId },
        include: { globalJob: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.resume.findMany({
        where: { userId, isDeleted: false },
        select: { id: true, name: true, fileName: true, fileUrl: true, targetCategories: true, detectedSkills: true, isDefault: true, createdAt: true },
      }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    const jobsCsv = [
      "Title,Company,Location,Stage,Match Score,Source,Applied Via,Created",
      ...userJobs.map((j) =>
        [
          quote(j.globalJob.title),
          quote(j.globalJob.company),
          quote(j.globalJob.location || ""),
          j.stage,
          j.matchScore ?? "",
          j.globalJob.source,
          "",
          j.createdAt.toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const applicationsCsv = [
      "Subject,Recipient,Status,Sent At,Applied Via,Email Confidence,Created",
      ...applications.map((a) =>
        [
          quote(a.subject),
          a.recipientEmail,
          a.status,
          a.sentAt?.toISOString() || "",
          a.appliedVia,
          a.emailConfidence || "",
          a.createdAt.toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const activitiesCsv = [
      "Type,Description,Created",
      ...activities.map((a) =>
        [a.type, quote(a.description), a.createdAt.toISOString()].join(",")
      ),
    ].join("\n");

    const exportData = {
      exportDate: new Date().toISOString(),
      jobs: jobsCsv,
      applications: applicationsCsv,
      activities: activitiesCsv,
      resumes: resumes.map((r) => ({
        name: r.name,
        fileName: r.fileName,
        fileUrl: r.fileUrl,
        categories: r.targetCategories,
        skills: r.detectedSkills,
        isDefault: r.isDefault,
      })),
      settings: settings
        ? {
            fullName: settings.fullName,
            keywords: settings.keywords,
            city: settings.city,
            country: settings.country,
            experienceLevel: settings.experienceLevel,
            preferredCategories: settings.preferredCategories,
          }
        : null,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="jobpilot-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function quote(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
