/**
 * Auto-apply integration — ensure a JobApplication has a JD-tailored resume.
 *
 * Called from `sendApplication` right before the email is composed. If the
 * user has a structured ResumeProfile AND the application doesn't already
 * carry a resumeGeneration, we run the JD ranker + render pipeline against
 * the globalJob.description and save the result. Idempotent: if the
 * application already has a generation, this is a no-op.
 *
 * Best-effort: any failure returns null and the caller falls back to the
 * existing uploaded Resume PDF. We never block the send on resume generation.
 */

import { prisma } from "@/lib/prisma";
import { rankForJd, applyRankingToRenderInput } from "./jd-ranker";
import { buildRenderInput, toResumeProfile } from "./profile-mapper";
import { renderResume } from "./render";

const MIN_JD_LENGTH = 80;

interface EnsureResult {
  generationId: string;
  templateId: string;
  templateVersion: string;
  /** True iff this call did the rendering (i.e. wasn't already attached). */
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
          globalJob: {
            select: { description: true, title: true, company: true },
          },
        },
      },
    },
  });

  if (!application) return null;

  // Already attached — return the existing generation metadata.
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

  // No profile → can't generate. Caller falls back to uploaded resume.
  const profileRow = await prisma.resumeProfile.findUnique({
    where: { userId: application.userId },
    include: {
      summaries: true,
      experiences: true,
      projects: true,
      education: true,
      certifications: true,
    },
  });
  if (!profileRow) return null;

  const jdText = (application.userJob.globalJob.description ?? "").trim();
  const profile = toResumeProfile(profileRow);

  // Build base render input — defaults are fine if no usable JD.
  let renderInput = buildRenderInput(profile, { templateId: "T01", pageTarget: 1 });

  // Tailor if JD has enough signal to be worth running the LLM on.
  if (jdText.length >= MIN_JD_LENGTH) {
    try {
      const ranking = await rankForJd(profile, jdText, { maxProjects: 3 });
      renderInput = applyRankingToRenderInput(renderInput, profile, ranking.ranking);
    } catch (err) {
      // Ranker down or both providers exhausted — keep default ordering.
      // We DO NOT abort here; the user still gets a tailored PDF in their
      // template of choice, just without JD-aware ordering.
      console.warn(
        `[auto-attach] JD ranker failed for application ${applicationId}, using default order:`,
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
      profileId: profileRow.id,
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
