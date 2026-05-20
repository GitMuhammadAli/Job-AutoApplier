/**
 * Resume generator — typed contracts.
 *
 * One source of truth for:
 *   - The shape of a resume profile (sent over the wire, stored in DB, rendered).
 *   - Validation at every server boundary (Zod schemas → throw on bad input).
 *   - The narrow `ResumeRenderInput` contract that the render library accepts.
 *
 * Hard rule reflection: NO schema here lets the AI inject new content.
 * The render input takes verbatim user strings + ordering/selection.
 * There is intentionally no `bulletOverride`, `customSummary`, or
 * `injectKeywords` field — the render pipeline literally cannot fabricate.
 */

import { z } from "zod";

// ── Reusable primitives ──────────────────────────────────────────────

/** Bullets, summary lines, etc. — server-enforced bullet length cap. */
const BULLET_MAX = 280;
/** Skill string ceiling — long skills are usually misuse. */
const SKILL_MAX = 64;
/** Summary block ceiling — 1-page resume's summary block. */
const SUMMARY_MAX = 600;

const trimmedShort = (max: number) =>
  z.string().trim().min(1).max(max);

const optionalUrl = z
  .string()
  .trim()
  .url("must be a valid https?:// URL")
  .or(z.literal(""))
  .optional()
  .transform((v) => (v ? v : undefined));

const bullet = trimmedShort(BULLET_MAX);
const skill = trimmedShort(SKILL_MAX);

// ── Header ───────────────────────────────────────────────────────────

export const ResumeHeaderSchema = z.object({
  fullName: trimmedShort(120),
  headline: trimmedShort(140),
  location: trimmedShort(120).optional(),
  email: z.string().trim().email(),
  phone: trimmedShort(40).optional(),
  websiteUrl: optionalUrl,
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
});
export type ResumeHeader = z.infer<typeof ResumeHeaderSchema>;

// ── Sections ─────────────────────────────────────────────────────────

export const ResumeSummarySchema = z.object({
  id: z.string().optional(),
  label: trimmedShort(60),
  content: trimmedShort(SUMMARY_MAX),
  isDefault: z.boolean().default(false),
});
export type ResumeSummary = z.infer<typeof ResumeSummarySchema>;

export const ResumeExperienceSchema = z.object({
  id: z.string().optional(),
  company: trimmedShort(120),
  title: trimmedShort(120),
  location: trimmedShort(120).optional(),
  startDate: trimmedShort(40),
  endDate: trimmedShort(40).optional(),
  bullets: z.array(bullet).min(1).max(8),
  order: z.number().int().nonnegative(),
});
export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>;

export const ResumeProjectSchema = z.object({
  id: z.string().optional(),
  title: trimmedShort(120),
  role: trimmedShort(60).optional(),
  oneLiner: trimmedShort(200),
  bullets: z.array(bullet).min(1).max(6),
  stack: z.array(skill).min(1).max(20),
  liveUrl: optionalUrl,
  repoUrl: optionalUrl,
  isFeatured: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});
export type ResumeProject = z.infer<typeof ResumeProjectSchema>;

export const ResumeEducationSchema = z.object({
  id: z.string().optional(),
  institution: trimmedShort(160),
  degree: trimmedShort(160),
  startDate: trimmedShort(40).optional(),
  endDate: trimmedShort(40).optional(),
  details: trimmedShort(400).optional(),
  order: z.number().int().nonnegative(),
});
export type ResumeEducation = z.infer<typeof ResumeEducationSchema>;

export const ResumeCertificationSchema = z.object({
  id: z.string().optional(),
  name: trimmedShort(160),
  issuer: trimmedShort(160).optional(),
  issuedDate: trimmedShort(40).optional(),
  credentialUrl: optionalUrl,
  order: z.number().int().nonnegative(),
});
export type ResumeCertification = z.infer<typeof ResumeCertificationSchema>;

// ── Master profile (the single source of truth per user) ─────────────

export const ResumeProfileSchema = z.object({
  id: z.string().optional(),
  header: ResumeHeaderSchema,
  skills: z.array(skill).max(80),
  skillsLocked: z.boolean().default(false),
  summaries: z.array(ResumeSummarySchema).min(0).max(3),
  experiences: z.array(ResumeExperienceSchema),
  projects: z.array(ResumeProjectSchema),
  education: z.array(ResumeEducationSchema),
  certifications: z.array(ResumeCertificationSchema),
});
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;

// ── Render input ─────────────────────────────────────────────────────
// What the template renderer accepts. Narrow on purpose — every string
// here MUST exist verbatim somewhere in the user's profile or the audit
// test fails CI.

export const SectionKeySchema = z.enum([
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
]);
export type SectionKey = z.infer<typeof SectionKeySchema>;

export const ResumeRenderInputSchema = z.object({
  templateId: z.string(),
  templateVersion: z.string(),
  pageTarget: z.union([z.literal(1), z.literal(2)]),

  header: ResumeHeaderSchema,

  summary: z
    .object({
      content: z.string(),
      sourceId: z.string(),
    })
    .optional(),

  skills: z.array(skill),

  experiences: z.array(
    ResumeExperienceSchema.extend({ sourceId: z.string() }).omit({ order: true }),
  ),

  projects: z.array(
    ResumeProjectSchema.extend({ sourceId: z.string() }).omit({ order: true, isFeatured: true }),
  ),

  education: z.array(
    ResumeEducationSchema.extend({ sourceId: z.string() }).omit({ order: true }),
  ),

  certifications: z.array(
    ResumeCertificationSchema.extend({ sourceId: z.string() }).omit({ order: true }),
  ),

  sectionOrder: z.array(SectionKeySchema).min(1).max(6),
});
export type ResumeRenderInput = z.infer<typeof ResumeRenderInputSchema>;

// ── API request shapes ───────────────────────────────────────────────

export const GenerateRequestSchema = z.object({
  profileId: z.string(),
  variantId: z.string().optional(),
  jdText: z.string().max(20_000).optional(), // Phase 2 — present but ignored in P1
  templateId: z.string().default("T01"),
  pageTarget: z.union([z.literal(1), z.literal(2)]).default(1),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const RecommendExistingResumeRequestSchema = z.object({
  jdText: z.string().min(20).max(20_000),
  globalJobId: z.string().optional(),
});
export type RecommendExistingResumeRequest = z.infer<typeof RecommendExistingResumeRequestSchema>;

export const RecommendExistingResumeResultSchema = z.object({
  /** Existing Resume.id ranked best-fit for the JD, or null if user has no uploads. */
  resumeId: z.string().nullable(),
  resumeName: z.string().nullable(),
  /** Per-candidate scoring breakdown — surfaced in UI so user can see why. */
  candidates: z.array(
    z.object({
      resumeId: z.string(),
      resumeName: z.string(),
      score: z.number(),
      matchedSkills: z.array(z.string()),
      reason: z.string(),
    }),
  ),
});
export type RecommendExistingResumeResult = z.infer<typeof RecommendExistingResumeResultSchema>;

// ── Limits exported so the UI can mirror server-side enforcement ──────

export const RESUME_LIMITS = {
  BULLET_MAX,
  SKILL_MAX,
  SUMMARY_MAX,
  MAX_SUMMARIES: 3,
  MAX_BULLETS_PER_EXP: 8,
  MAX_BULLETS_PER_PROJECT: 6,
  MAX_SKILLS_TOTAL: 80,
} as const;
