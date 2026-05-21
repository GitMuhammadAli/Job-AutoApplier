/**
 * GET /api/resumes/profile  → returns user's structured resume profile (composed)
 * PUT /api/resumes/profile  → upserts the entire profile in a single transaction
 *
 * Storage layout (after the flatten migration):
 *   - Header → UserSettings (fullName, phone, links, city, country, resumeHeadline)
 *              + User (email)
 *   - Skills → UserSettings.resumeSkills[]
 *   - Sections → per-user tables (ResumeSummary/Experience/Project/Education/Certification)
 *
 * PUT semantics:
 *   - Wholesale-replace child rows (delete + recreate)
 *   - Header + skills upsert on UserSettings
 *   - Single Prisma transaction
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { ResumeProfileSchema } from "@/lib/resume/types";
import { bundleToResumeProfile } from "@/lib/resume/profile-mapper";

export const dynamic = "force-dynamic";

async function loadBundle(userId: string) {
  const [user, settings, summaries, experiences, projects, education, certifications] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.resumeSummary.findMany({ where: { userId } }),
      prisma.resumeExperience.findMany({ where: { userId } }),
      prisma.resumeProject.findMany({ where: { userId } }),
      prisma.resumeEducation.findMany({ where: { userId } }),
      prisma.resumeCertification.findMany({ where: { userId } }),
    ]);
  if (!user) throw new Error("User not found");
  return { user, settings, summaries, experiences, projects, education, certifications };
}

/**
 * "Has profile" gate: any structured body content present.
 * Used by the dashboard to decide whether to show the empty-state picker.
 */
function profileIsBlank(bundle: Awaited<ReturnType<typeof loadBundle>>): boolean {
  return (
    bundle.summaries.length === 0 &&
    bundle.experiences.length === 0 &&
    bundle.projects.length === 0 &&
    bundle.education.length === 0 &&
    bundle.certifications.length === 0 &&
    (!bundle.settings?.resumeSkills || bundle.settings.resumeSkills.length === 0)
  );
}

export async function GET() {
  const userId = await getAuthUserId();
  const bundle = await loadBundle(userId);

  // If nothing has been entered yet, return null so the UI shows onboarding.
  if (profileIsBlank(bundle)) {
    return NextResponse.json({ profile: null });
  }
  return NextResponse.json({ profile: bundleToResumeProfile(bundle) });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ResumeProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // De-dup skills case-insensitively
  const seen = new Set<string>();
  const skills = input.skills.filter((s) => {
    const lower = s.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  await prisma.$transaction(async (tx) => {
    // 1. Upsert UserSettings header + skills
    await tx.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        fullName: input.header.fullName,
        applicationEmail: input.header.email,
        phone: input.header.phone,
        portfolioUrl: input.header.websiteUrl,
        githubUrl: input.header.githubUrl,
        linkedinUrl: input.header.linkedinUrl,
        resumeHeadline: input.header.headline,
        resumeSkills: skills,
        resumeSkillsLocked: input.skillsLocked,
      },
      update: {
        fullName: input.header.fullName,
        applicationEmail: input.header.email,
        phone: input.header.phone,
        portfolioUrl: input.header.websiteUrl,
        githubUrl: input.header.githubUrl,
        linkedinUrl: input.header.linkedinUrl,
        resumeHeadline: input.header.headline,
        resumeSkills: skills,
        resumeSkillsLocked: input.skillsLocked,
      },
    });

    // 2. Wholesale-replace all section rows
    await Promise.all([
      tx.resumeSummary.deleteMany({ where: { userId } }),
      tx.resumeExperience.deleteMany({ where: { userId } }),
      tx.resumeProject.deleteMany({ where: { userId } }),
      tx.resumeEducation.deleteMany({ where: { userId } }),
      tx.resumeCertification.deleteMany({ where: { userId } }),
    ]);

    if (input.summaries.length > 0) {
      await tx.resumeSummary.createMany({
        data: input.summaries.map((s) => ({
          userId,
          label: s.label,
          content: s.content,
          isDefault: s.isDefault,
        })),
      });
    }

    if (input.experiences.length > 0) {
      await tx.resumeExperience.createMany({
        data: input.experiences.map((e, idx) => ({
          userId,
          company: e.company,
          title: e.title,
          location: e.location,
          startDate: e.startDate,
          endDate: e.endDate,
          bullets: e.bullets,
          order: e.order ?? idx,
        })),
      });
    }

    if (input.projects.length > 0) {
      await tx.resumeProject.createMany({
        data: input.projects.map((p, idx) => ({
          userId,
          title: p.title,
          role: p.role,
          oneLiner: p.oneLiner,
          bullets: p.bullets,
          stack: p.stack,
          liveUrl: p.liveUrl,
          repoUrl: p.repoUrl,
          isFeatured: p.isFeatured,
          order: p.order ?? idx,
        })),
      });
    }

    if (input.education.length > 0) {
      await tx.resumeEducation.createMany({
        data: input.education.map((e, idx) => ({
          userId,
          institution: e.institution,
          degree: e.degree,
          startDate: e.startDate,
          endDate: e.endDate,
          details: e.details,
          order: e.order ?? idx,
        })),
      });
    }

    if (input.certifications.length > 0) {
      await tx.resumeCertification.createMany({
        data: input.certifications.map((c, idx) => ({
          userId,
          name: c.name,
          issuer: c.issuer,
          issuedDate: c.issuedDate,
          credentialUrl: c.credentialUrl,
          order: c.order ?? idx,
        })),
      });
    }
  });

  const bundle = await loadBundle(userId);
  return NextResponse.json({ profile: bundleToResumeProfile(bundle) });
}
