/**
 * Profile mapper — convert between Prisma row shapes and the typed
 * `ResumeProfile` / `ResumeRenderInput` contracts.
 *
 * Why a dedicated module:
 *   - Prisma returns optional fields as `string | null`; our Zod types use
 *     `string | undefined`. The mapper normalizes the boundary in one place.
 *   - Render-input assembly applies the selection / ordering logic without
 *     touching the database schema.
 */

import type {
  ResumeProfile as PrismaResumeProfile,
  ResumeSummary as PrismaResumeSummary,
  ResumeExperience as PrismaResumeExperience,
  ResumeProject as PrismaResumeProject,
  ResumeEducation as PrismaResumeEducation,
  ResumeCertification as PrismaResumeCertification,
  ResumeVariant as PrismaResumeVariant,
} from "@prisma/client";

import type {
  ResumeProfile,
  ResumeRenderInput,
  ResumeHeader,
  SectionKey,
} from "./types";

import { getTemplate, DEFAULT_TEMPLATE_ID } from "./templates/registry";

type ProfileWithRelations = PrismaResumeProfile & {
  summaries: PrismaResumeSummary[];
  experiences: PrismaResumeExperience[];
  projects: PrismaResumeProject[];
  education: PrismaResumeEducation[];
  certifications: PrismaResumeCertification[];
};

// ── Prisma → typed ResumeProfile ─────────────────────────────────────

function header(p: PrismaResumeProfile): ResumeHeader {
  return {
    fullName: p.fullName,
    headline: p.headline,
    location: p.location ?? undefined,
    email: p.email,
    phone: p.phone ?? undefined,
    websiteUrl: p.websiteUrl ?? undefined,
    githubUrl: p.githubUrl ?? undefined,
    linkedinUrl: p.linkedinUrl ?? undefined,
  };
}

export function toResumeProfile(p: ProfileWithRelations): ResumeProfile {
  return {
    id: p.id,
    header: header(p),
    skills: [...p.skills],
    skillsLocked: p.skillsLocked,
    summaries: p.summaries.map((s) => ({
      id: s.id,
      label: s.label,
      content: s.content,
      isDefault: s.isDefault,
    })),
    experiences: p.experiences
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        location: e.location ?? undefined,
        startDate: e.startDate,
        endDate: e.endDate ?? undefined,
        bullets: [...e.bullets],
        order: e.order,
      })),
    projects: p.projects
      .sort((a, b) => a.order - b.order)
      .map((proj) => ({
        id: proj.id,
        title: proj.title,
        role: proj.role ?? undefined,
        oneLiner: proj.oneLiner,
        bullets: [...proj.bullets],
        stack: [...proj.stack],
        liveUrl: proj.liveUrl ?? undefined,
        repoUrl: proj.repoUrl ?? undefined,
        isFeatured: proj.isFeatured,
        order: proj.order,
      })),
    education: p.education
      .sort((a, b) => a.order - b.order)
      .map((ed) => ({
        id: ed.id,
        institution: ed.institution,
        degree: ed.degree,
        startDate: ed.startDate ?? undefined,
        endDate: ed.endDate ?? undefined,
        details: ed.details ?? undefined,
        order: ed.order,
      })),
    certifications: p.certifications
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer ?? undefined,
        issuedDate: c.issuedDate ?? undefined,
        credentialUrl: c.credentialUrl ?? undefined,
        order: c.order,
      })),
  };
}

// ── ResumeProfile + Variant + options → ResumeRenderInput ────────────

const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
];

interface BuildRenderInputOptions {
  templateId?: string;
  pageTarget?: 1 | 2;
  variant?: PrismaResumeVariant | null;
}

/**
 * Build a render input from a structured profile + optional variant.
 *
 * In Phase 1 (no JD tailoring): if a variant is provided, use its ordering;
 * otherwise use the profile's natural order with sensible defaults.
 *
 * In Phase 2 (JD tailoring): the ranker will produce a variant-like result
 * and call this with that variant.
 */
export function buildRenderInput(
  profile: ResumeProfile,
  options: BuildRenderInputOptions = {},
): ResumeRenderInput {
  const templateId = options.variant?.templateId ?? options.templateId ?? DEFAULT_TEMPLATE_ID;
  const tpl = getTemplate(templateId);
  const pageTarget = (options.variant?.pageTarget as 1 | 2 | undefined) ?? options.pageTarget ?? 1;

  // Section order
  const sectionOrder: SectionKey[] =
    options.variant?.sectionOrder && options.variant.sectionOrder.length > 0
      ? (options.variant.sectionOrder.filter((s): s is SectionKey =>
          DEFAULT_SECTION_ORDER.includes(s as SectionKey),
        ))
      : DEFAULT_SECTION_ORDER;

  // Summary
  let summary: ResumeRenderInput["summary"];
  if (options.variant?.summaryId) {
    const picked = profile.summaries.find((s) => s.id === options.variant?.summaryId);
    if (picked) summary = { content: picked.content, sourceId: picked.id! };
  } else {
    const def = profile.summaries.find((s) => s.isDefault) ?? profile.summaries[0];
    if (def) summary = { content: def.content, sourceId: def.id! };
  }

  // Skills
  const skills =
    options.variant?.skillsOrder && options.variant.skillsOrder.length > 0
      ? options.variant.skillsOrder.filter((s) => profile.skills.includes(s))
      : [...profile.skills];

  // Experiences — ordered subset (default: all in profile order)
  const expSelected =
    options.variant?.experienceIds && options.variant.experienceIds.length > 0
      ? options.variant.experienceIds
          .map((id) => profile.experiences.find((e) => e.id === id))
          .filter((e): e is NonNullable<typeof e> => Boolean(e))
      : profile.experiences;

  // Projects — ordered subset
  const projSelected =
    options.variant?.projectIds && options.variant.projectIds.length > 0
      ? options.variant.projectIds
          .map((id) => profile.projects.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
      : profile.projects;

  return {
    templateId,
    templateVersion: tpl.version,
    pageTarget,
    header: profile.header,
    summary,
    skills,
    experiences: expSelected.map((e) => ({
      sourceId: e.id!,
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.bullets,
    })),
    projects: projSelected.map((p) => ({
      sourceId: p.id!,
      title: p.title,
      role: p.role,
      oneLiner: p.oneLiner,
      bullets: p.bullets,
      stack: p.stack,
      liveUrl: p.liveUrl,
      repoUrl: p.repoUrl,
    })),
    education: profile.education.map((e) => ({
      sourceId: e.id!,
      institution: e.institution,
      degree: e.degree,
      startDate: e.startDate,
      endDate: e.endDate,
      details: e.details,
    })),
    certifications: profile.certifications.map((c) => ({
      sourceId: c.id!,
      name: c.name,
      issuer: c.issuer,
      issuedDate: c.issuedDate,
      credentialUrl: c.credentialUrl,
    })),
    sectionOrder,
  };
}
