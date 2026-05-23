/**
 * Profile mapper — load/save user-level resume data WITHOUT a ResumeProfile hub.
 *
 * After the flatten migration, the resume profile is composed at runtime from:
 *   - User                       → fullName (User.name), email (User.email)
 *   - UserSettings               → headline, location, phone, links, skills, skillsLocked
 *   - ResumeSummary[]            → per-user, by userId
 *   - ResumeExperience[]         → per-user, by userId
 *   - ResumeProject[]            → per-user, by userId
 *   - ResumeEducation[]          → per-user, by userId
 *   - ResumeCertification[]      → per-user, by userId
 *
 * The `id` field on the typed `ResumeProfile` is simply `userId` (1:1).
 *
 * Also retains `buildRenderInput` — the pure function the renderer consumes.
 */

import type {
  User as PrismaUser,
  UserSettings as PrismaUserSettings,
  ResumeSummary as PrismaResumeSummary,
  ResumeExperience as PrismaResumeExperience,
  ResumeProject as PrismaResumeProject,
  ResumeEducation as PrismaResumeEducation,
  ResumeCertification as PrismaResumeCertification,
} from "@prisma/client";

import type {
  ResumeProfile,
  ResumeRenderInput,
  ResumeHeader,
  SectionKey,
} from "./types";

import { getTemplate, DEFAULT_TEMPLATE_ID } from "./templates/registry";

// ── Composed shape returned by the per-user loader ───────────────────

export interface UserResumeBundle {
  user: Pick<PrismaUser, "id" | "name" | "email">;
  settings: PrismaUserSettings | null;
  summaries: PrismaResumeSummary[];
  experiences: PrismaResumeExperience[];
  projects: PrismaResumeProject[];
  education: PrismaResumeEducation[];
  certifications: PrismaResumeCertification[];
}

// ── Prisma rows → typed ResumeProfile ────────────────────────────────

function header(
  user: UserResumeBundle["user"],
  settings: PrismaUserSettings | null,
): ResumeHeader {
  return {
    fullName: settings?.fullName ?? user.name ?? "",
    headline: settings?.resumeHeadline ?? "",
    location: composeLocation(settings),
    email: settings?.applicationEmail ?? user.email ?? "",
    phone: settings?.phone ?? undefined,
    websiteUrl: settings?.portfolioUrl ?? undefined,
    githubUrl: settings?.githubUrl ?? undefined,
    linkedinUrl: settings?.linkedinUrl ?? undefined,
  };
}

function composeLocation(s: PrismaUserSettings | null): string | undefined {
  if (!s) return undefined;
  const parts = [s.city, s.country].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : undefined;
}

export function bundleToResumeProfile(bundle: UserResumeBundle): ResumeProfile {
  const s = bundle.settings;
  return {
    id: bundle.user.id, // userId == profile id in the flat model
    header: header(bundle.user, s),
    skills: [...(s?.resumeSkills ?? [])],
    skillsLocked: s?.resumeSkillsLocked ?? false,
    summaries: bundle.summaries.map((sum) => ({
      id: sum.id,
      label: sum.label,
      content: sum.content,
      isDefault: sum.isDefault,
    })),
    experiences: bundle.experiences
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
    projects: bundle.projects
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        id: p.id,
        title: p.title,
        role: p.role ?? undefined,
        oneLiner: p.oneLiner,
        bullets: [...p.bullets],
        stack: [...p.stack],
        liveUrl: p.liveUrl ?? undefined,
        repoUrl: p.repoUrl ?? undefined,
        isFeatured: p.isFeatured,
        order: p.order,
      })),
    education: bundle.education
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
    certifications: bundle.certifications
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

/** Back-compat alias — old call sites used `toResumeProfile(p)`. */
export const toResumeProfile = bundleToResumeProfile;

// ── ResumeProfile + options → ResumeRenderInput ──────────────────────

const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
];

interface BuildRenderInputOptions {
  templateId?: string;
  pageTarget?: 1 | 2 | "unlimited";
  /** Override section order (e.g. JD-driven projects-first). */
  sectionOrder?: SectionKey[];
}

/**
 * Build a render input from a profile.
 *
 * In Phase 1 (no JD tailoring): natural order, all sections.
 * In Phase 2: the chained tailorResume → templateFill agent produces ordering
 * hints that this function applies (skillsOrder, projectIds, summaryId,
 * sectionOrder) via dedicated apply-* helpers below.
 */
export function buildRenderInput(
  profile: ResumeProfile,
  options: BuildRenderInputOptions = {},
): ResumeRenderInput {
  const templateId = options.templateId ?? DEFAULT_TEMPLATE_ID;
  const tpl = getTemplate(templateId);
  // Templates that opt into multiPage (Academic CV) auto-upgrade to "unlimited"
  // when no caller override is passed. Otherwise default to 1.
  const pageTarget = options.pageTarget ?? (tpl.multiPage ? "unlimited" : 1);
  // Per-template default wins over the global default when no override is passed.
  // JD-driven ordering still takes precedence (caller passes options.sectionOrder).
  const sectionOrder =
    options.sectionOrder ?? (tpl.defaultSectionOrder as SectionKey[] | undefined) ?? DEFAULT_SECTION_ORDER;

  // Summary — default to the isDefault one, else first
  const def =
    profile.summaries.find((s) => s.isDefault) ?? profile.summaries[0];
  const summary = def
    ? { content: def.content, sourceId: def.id! }
    : undefined;

  return {
    templateId,
    templateVersion: tpl.version,
    pageTarget,
    header: profile.header,
    summary,
    skills: [...profile.skills],
    experiences: profile.experiences.map((e) => ({
      sourceId: e.id!,
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.bullets,
    })),
    projects: profile.projects.map((p) => ({
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

// ── Apply a TemplateFillResult ranking to a base render input ────────
// (See src/lib/agents/resume-template-fill.ts for the agent that produces
// these orderings. Keeping the application logic here so callers don't need
// to know about the agent's internals.)

export interface RenderInputRanking {
  skillsOrder?: string[];
  projectIds?: string[];
  summaryId?: string | null;
  sectionOrder?: SectionKey[];
}

export function applyRanking(
  base: ResumeRenderInput,
  profile: ResumeProfile,
  ranking: RenderInputRanking,
): ResumeRenderInput {
  // Skills: keep only those in profile.skills (the hard rule). Order per
  // ranking; preserve original ordering for anything not in ranking.
  const skills = (() => {
    if (!ranking.skillsOrder || ranking.skillsOrder.length === 0) {
      return base.skills;
    }
    const inProfile = new Set(profile.skills);
    const ordered = ranking.skillsOrder.filter((s) => inProfile.has(s));
    const rest = profile.skills.filter((s) => !ordered.includes(s));
    return [...ordered, ...rest];
  })();

  // Projects: ordered subset by id
  const projects = (() => {
    if (!ranking.projectIds || ranking.projectIds.length === 0) {
      return base.projects;
    }
    const map = new Map(profile.projects.map((p) => [p.id!, p]));
    return ranking.projectIds
      .map((id) => map.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        sourceId: p.id!,
        title: p.title,
        role: p.role,
        oneLiner: p.oneLiner,
        bullets: p.bullets,
        stack: p.stack,
        liveUrl: p.liveUrl,
        repoUrl: p.repoUrl,
      }));
  })();

  // Summary
  let summary = base.summary;
  if (ranking.summaryId) {
    const picked = profile.summaries.find((s) => s.id === ranking.summaryId);
    if (picked) summary = { content: picked.content, sourceId: picked.id! };
  }

  return {
    ...base,
    summary,
    skills,
    projects,
    sectionOrder: ranking.sectionOrder ?? base.sectionOrder,
  };
}
