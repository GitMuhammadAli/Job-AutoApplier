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
  computeKeywordCoverage,
  applyCoverageToRanking,
  auditCoverageAgainstHtml,
  findLostCoverageFromDrops,
} from "./keyword-coverage";
import {
  bundleToResumeProfile,
  buildRenderInput,
  applyRanking,
} from "./profile-mapper";
import { renderResume } from "./render";
import { DEFAULT_TEMPLATE_ID } from "./templates/registry";
import {
  passesProfileGate,
  pickBestUploadsForParse,
  parseUploadedPdfToProfile,
} from "./parse-uploaded-pdf";

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

  let profile = bundleToResumeProfile({
    user, settings, summaries, experiences, projects, education, certifications,
  });

  // Structured-profile gate failure — try parsing one of the user's uploads
  // as a fallback so auto-apply still gets a tailored PDF. Previously this
  // path returned null and the user got a generic uploaded PDF attached
  // even when their JD had specific keywords we could've matched. Limit to
  // top 2 candidates to bound LLM cost on the auto-send path.
  if (!passesProfileGate(profile)) {
    const candidates = await pickBestUploadsForParse(userId, 2);
    let parsedAny = false;
    for (const candidate of candidates) {
      try {
        const parsed = await parseUploadedPdfToProfile(candidate.id, userId);
        if (parsed.profile && passesProfileGate(parsed.profile)) {
          profile = parsed.profile;
          parsedAny = true;
          console.log(
            `[auto-attach] application ${applicationId}: parsed structured profile from upload "${candidate.name}"`,
          );
          break;
        }
      } catch (err) {
        console.warn(
          `[auto-attach] application ${applicationId}: parse failed for "${candidate.name}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (!parsedAny) {
      console.log(
        `[auto-attach] application ${applicationId}: no usable profile from uploads (${candidates.length} tried) — using uploaded PDF as-is`,
      );
      return null;
    }
  }

  const jdText = (application.userJob.globalJob.description ?? "").trim();
  let renderInput = buildRenderInput(profile, { templateId: DEFAULT_TEMPLATE_ID, pageTarget: 1 });
  // Keywords the coverage layer promises the rendered PDF will contain.
  // We grep the post-render HTML for these to catch silent dropouts (page
  // trim, template hiding sections, etc.). Audit only fires on auto-apply
  // when the JD chain actually ran.
  let claimedKeywords: string[] = [];

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

      // Deterministic keyword force-include — same as /api/resumes/generate.
      // Without this, auto-sent resumes can drop a JD keyword the user
      // provably has (the WebRTC bug class). Auto-apply scales the problem
      // — a single resume issue ships to dozens of jobs per day.
      const coverage = computeKeywordCoverage({
        profile,
        jdText,
        selectedProjectIds: fill.projectIds,
        selectedSkills: fill.skillsOrder,
      });
      const promoted = applyCoverageToRanking(
        fill.projectIds,
        fill.skillsOrder,
        coverage,
        { maxProjects: 3, maxSkills: 80 },
      );
      if (promoted.forcedProjects.length > 0 || promoted.forcedSkills.length > 0) {
        console.log(
          `[auto-attach] application ${applicationId}: force-included ${promoted.forcedProjects.length} project(s), ${promoted.forcedSkills.length} skill(s) for JD keywords user has`,
        );
      }
      // Trade-off visibility for auto-apply — same detection the user-facing
      // generate route surfaces in the UI. Auto-apply can't pause for a
      // "use 2 pages?" prompt, so we just log the silent loss for ops.
      if (promoted.droppedProjects.length > 0) {
        const lost = findLostCoverageFromDrops(
          coverage,
          promoted.droppedProjects,
          promoted.droppedSkills,
          promoted.projectIds,
          promoted.skills,
        );
        if (lost.length > 0) {
          console.warn(
            `[auto-attach] application ${applicationId}: force-include trade — lost coverage on ${lost.length} keyword(s): ${lost.slice(0, 10).join(", ")}. Consider switching this user to 2pg default.`,
          );
        }
      }
      claimedKeywords = Array.from(
        new Set([...coverage.covered, ...coverage.inProfileNotPicked]),
      );

      renderInput = applyRanking(renderInput, profile, {
        skillsOrder: promoted.skills,
        projectIds: promoted.projectIds,
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

  // Post-render audit — log silent keyword dropouts. Auto-apply ships
  // without user review, so we want operational visibility when our
  // claims don't match the rendered PDF. Cheap (regex strip + substring).
  if (claimedKeywords.length > 0) {
    const audit = auditCoverageAgainstHtml(html, claimedKeywords);
    if (audit.notLanded.length > 0) {
      console.warn(
        `[auto-attach] application ${applicationId}: ${audit.notLanded.length} claimed keyword(s) didn't land in the auto-rendered PDF: ${audit.notLanded.slice(0, 10).join(", ")}`,
      );
    }
  }

  const pageTargetInt =
    renderInput.pageTarget === "unlimited" ? 0 : renderInput.pageTarget;
  const generation = await prisma.resumeGeneration.create({
    data: {
      userId,
      templateId: renderInput.templateId,
      templateVersion,
      pageTarget: pageTargetInt,
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
