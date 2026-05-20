/**
 * GET /api/resumes/profile  → returns user's structured ResumeProfile (or null)
 * PUT /api/resumes/profile  → upserts the entire profile in a single transaction
 *
 * Auth: required. The profile is keyed 1:1 with User.
 *
 * PUT semantics:
 *   - Replaces all section rows wholesale (delete + recreate).
 *     This is intentional: editing happens client-side, the server sees
 *     the final state and stores it. No partial-update endpoint in v1.
 *   - Wrapped in `prisma.$transaction` so a partial failure can't leave
 *     orphan rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { ResumeProfileSchema } from "@/lib/resume/types";
import { toResumeProfile } from "@/lib/resume/profile-mapper";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getAuthUserId();
  const row = await prisma.resumeProfile.findUnique({
    where: { userId },
    include: {
      summaries: true,
      experiences: true,
      projects: true,
      education: true,
      certifications: true,
    },
  });
  if (!row) {
    return NextResponse.json({ profile: null });
  }
  return NextResponse.json({ profile: toResumeProfile(row) });
}

const PutBody = ResumeProfileSchema;

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // De-dup skills case-insensitively (server-side enforcement of UI hint)
  const seen = new Set<string>();
  const skills = input.skills.filter((s) => {
    const lower = s.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  const result = await prisma.$transaction(async (tx) => {
    // Upsert the profile shell (header + skills)
    const profile = await tx.resumeProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: input.header.fullName,
        headline: input.header.headline,
        location: input.header.location,
        email: input.header.email,
        phone: input.header.phone,
        websiteUrl: input.header.websiteUrl,
        githubUrl: input.header.githubUrl,
        linkedinUrl: input.header.linkedinUrl,
        skills,
        skillsLocked: input.skillsLocked,
      },
      update: {
        fullName: input.header.fullName,
        headline: input.header.headline,
        location: input.header.location,
        email: input.header.email,
        phone: input.header.phone,
        websiteUrl: input.header.websiteUrl,
        githubUrl: input.header.githubUrl,
        linkedinUrl: input.header.linkedinUrl,
        skills,
        skillsLocked: input.skillsLocked,
      },
    });

    // Wholesale-replace all child sections
    await Promise.all([
      tx.resumeSummary.deleteMany({ where: { profileId: profile.id } }),
      tx.resumeExperience.deleteMany({ where: { profileId: profile.id } }),
      tx.resumeProject.deleteMany({ where: { profileId: profile.id } }),
      tx.resumeEducation.deleteMany({ where: { profileId: profile.id } }),
      tx.resumeCertification.deleteMany({ where: { profileId: profile.id } }),
    ]);

    if (input.summaries.length > 0) {
      await tx.resumeSummary.createMany({
        data: input.summaries.map((s) => ({
          profileId: profile.id,
          label: s.label,
          content: s.content,
          isDefault: s.isDefault,
        })),
      });
    }

    if (input.experiences.length > 0) {
      await tx.resumeExperience.createMany({
        data: input.experiences.map((e, idx) => ({
          profileId: profile.id,
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
          profileId: profile.id,
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
          profileId: profile.id,
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
          profileId: profile.id,
          name: c.name,
          issuer: c.issuer,
          issuedDate: c.issuedDate,
          credentialUrl: c.credentialUrl,
          order: c.order ?? idx,
        })),
      });
    }

    return profile.id;
  });

  // Return the fresh profile
  const fresh = await prisma.resumeProfile.findUnique({
    where: { id: result },
    include: {
      summaries: true,
      experiences: true,
      projects: true,
      education: true,
      certifications: true,
    },
  });
  return NextResponse.json({ profile: fresh ? toResumeProfile(fresh) : null });
}
