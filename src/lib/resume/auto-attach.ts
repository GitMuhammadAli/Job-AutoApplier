/**
 * Auto-apply integration — ensure a JobApplication has a JD-tailored resume.
 *
 * Called from `sendApplication` right before the email is composed. If the
 * user has structured resume data AND the application doesn't already carry
 * a resumeGeneration, runs the existing agent chain (tailorResume →
 * fillTemplate) against the globalJob.description and saves the result.
 *
 * Best-effort: any failure returns null and the caller falls back to the
 * existing uploaded Resume PDF. We never block the send on resume generation.
 */

import { prisma } from "@/lib/prisma";
import { tailorResume } from "@/lib/agents/resume-tailor";
import { fillTemplate } from "@/lib/agents/resume-template-fill";
import {
  bundleToResumeProfile,
  buildRenderInput,
  applyRanking,
} from "./profile-mapper";
import { renderResume } from "./render";
import { DEFAULT_TEMPLATE_ID } from "./templates/registry";

const MIN_JD_LENGTH = 80;

interface EnsureResult {
  generationId: string;
  templateId: string;
  templateVersion: string;
  /** True iff this call did the rendering (vs reusing an existing one). */
  freshlyGenerated: boolean;
}

export async function ensureTailoredResume(
  applicationId: string,
): Promise<EnsureResult | null> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      resumeGenerationId: true,
      userJob: {
        select: {
          globalJob: { select: { description: true, title: true, company: true } },
        },
      },
    },
  });
  if (!application) return null;

  // Already attached — return the existing metadata.
  if (application.resumeGenerationId) {
    const existing = await prisma.resumeGeneration.findUnique({
      where: { id: application.resumeGenerationId },
      select: { id: true, templateId: true, templateVersion: true },
    });
    if (existing) {
      return {
        generationId: existing.id,
        templateId: existing.templateId,
        templateVersion: existing.templateVersion,
        freshlyGenerated: false,
      };
    }
  }

  // Load the user bundle
  const userId = application.userId;
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

  if (!user) return null;

  const profile = bundleToResumeProfile({
    user, settings, summaries, experiences, projects, education, certifications,
  });

  // Gate: no name/email or no body content → can't generate, fall back.
  const meetsGate =
    profile.header.fullName.trim().length > 0 &&
    profile.header.email.trim().length > 0 &&
    (profile.experiences.length > 0 || profile.projects.length > 0);
  if (!meetsGate) return null;

  const jdText = (application.userJob.globalJob.description ?? "").trim();
  let renderInput = buildRenderInput(profile, { templateId: DEFAULT_TEMPLATE_ID, pageTarget: 1 });

  if (jdText.length >= MIN_JD_LENGTH) {
    try {
      const tailored = await tailorResume({
        userSkills: profile.skills,
        jobDescription: jdText,
        jobTitle: application.userJob.globalJob.title,
      });
      const fill = await fillTemplate({
        profile,
        tailored,
        templateId: DEFAULT_TEMPLATE_ID,
        pageTarget: 1,
        jdText,
      });
      renderInput = applyRanking(renderInput, profile, {
        skillsOrder: fill.skillsOrder,
        projectIds: fill.projectIds,
        summaryId: fill.summaryId,
        sectionOrder: fill.sectionOrder,
      });
    } catch (err) {
      console.warn(
        `[auto-attach] Agent chain failed for application ${applicationId}, using default order:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  let html: string;
  let templateVersion: string;
  try {
    const r = renderResume(renderInput);
    html = r.html;
    templateVersion = r.templateVersion;
  } catch (err) {
    console.error(
      `[auto-attach] Render failed for application ${applicationId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  const generation = await prisma.resumeGeneration.create({
    data: {
      userId,
      templateId: renderInput.templateId,
      templateVersion,
      pageTarget: renderInput.pageTarget,
      htmlSnapshot: html,
      jdSnippet: jdText ? jdText.slice(0, 4000) : null,
      matchedKeywords: [],
    },
  });

  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { resumeGenerationId: generation.id },
  });

  return {
    generationId: generation.id,
    templateId: generation.templateId,
    templateVersion: generation.templateVersion,
    freshlyGenerated: true,
  };
}
