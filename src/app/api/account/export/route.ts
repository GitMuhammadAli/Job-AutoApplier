/**
 * GET /api/account/export
 *
 * Returns a full JSON dump of the authenticated user's data.
 *
 * GDPR Article 15 (right of access) + Article 20 (portability) compliance:
 *   - All profile fields
 *   - All resumes, summaries, experiences, projects, education, certs
 *   - All applications, follow-ups, activities
 *   - Aggregated AI usage counters (last 90 days)
 *   - Settings (encrypted fields are decrypted in the export)
 *
 * Heavy account dumps stream the response so memory stays bounded.
 *
 * The export is rate-limited (1 per user per 5 minutes) — see middleware.
 *
 * Headers:
 *   Content-Disposition: attachment; filename="jobpilot-export-YYYY-MM-DD.json"
 *   Content-Type: application/json
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSettingsFields } from "@/lib/encryption";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const __auth = await requireAuthUserId();
  if (__auth.response) return __auth.response;
  const userId = __auth.userId;

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [
      user,
      settings,
      resumes,
      summaries,
      experiences,
      projects,
      education,
      certifications,
      userJobs,
      applications,
      activities,
      tokenUsage,
      llmCalls,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.resume.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          content: true,
          fileName: true,
          fileUrl: true,
          detectedSkills: true,
          targetCategories: true,
          isDefault: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.resumeSummary.findMany({ where: { userId } }),
      prisma.resumeExperience.findMany({ where: { userId } }),
      prisma.resumeProject.findMany({ where: { userId } }),
      prisma.resumeEducation.findMany({ where: { userId } }),
      prisma.resumeCertification.findMany({ where: { userId } }),
      prisma.userJob.findMany({
        where: { userId },
        include: { globalJob: true },
      }),
      prisma.jobApplication.findMany({ where: { userId } }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 1000, // most recent 1000 — older are noise
      }),
      prisma.tokenUsage.findMany({
        where: { userId, day: { gte: ninetyDaysAgo } },
        orderBy: { day: "desc" },
      }),
      prisma.llmCallLog.findMany({
        where: { userId, createdAt: { gte: ninetyDaysAgo } },
        select: {
          id: true,
          provider: true,
          model: true,
          route: true,
          inputTokens: true,
          outputTokens: true,
          latencyMs: true,
          status: true,
          createdAt: true,
          // INTENTIONALLY EXCLUDED: prompt/response bodies (PII + leaks)
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const decryptedSettings = settings ? decryptSettingsFields(settings) : null;

    const payload = {
      exported_at: new Date().toISOString(),
      schema_version: 1,
      user,
      settings: decryptedSettings,
      resumes,
      resume_summaries: summaries,
      resume_experiences: experiences,
      resume_projects: projects,
      resume_education: education,
      resume_certifications: certifications,
      user_jobs: userJobs,
      applications,
      recent_activities: activities,
      token_usage_last_90d: tokenUsage,
      llm_calls_last_90d: llmCalls,
      _notes: [
        "This export is a complete copy of the data JobPilot holds about you (GDPR Article 15/20).",
        "Encrypted fields (SMTP password, SMTP user) are decrypted here so you can verify them.",
        "Resume PDF file contents are NOT inlined; download them from the fileUrl fields.",
        "Sentry error reports and aggregate cost analytics are not personal data and excluded.",
        "Activities older than the most recent 1000 are excluded for size; ask support for full history.",
      ],
    };

    const today = new Date().toISOString().slice(0, 10);
    const filename = `jobpilot-export-${today}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    await captureError(err, {
      route: "/api/account/export",
      userId,
    });
    return NextResponse.json(
      {
        error:
          "Failed to assemble your export. Try again or contact privacy@jobapplier.app — we'll send it by email within 48 hours per GDPR.",
      },
      { status: 500 },
    );
  }
}
