/**
 * POST /api/resumes/generate
 *
 * Body: { templateId?, pageTarget?, jdText? }
 *
 * Renders the user's profile to HTML, runs the anti-fabrication audit,
 * persists a ResumeGeneration row, returns preview/pdf URLs + diff.
 *
 * When jdText is provided: chains existing `tailorResume()` (Agent 2)
 * → new `fillTemplate()` (Agent 5) for JD-aware ordering. Bullets,
 * companies, titles, and dates are never rewritten — only ordering and
 * selection change.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { GenerateRequestSchema, type SectionKey } from "@/lib/resume/types";
import { renderResume, TemplateNotAvailableError } from "@/lib/resume/render";
import { FabricationError } from "@/lib/resume/audit";
import {
  bundleToResumeProfile,
  buildRenderInput,
  applyRanking,
} from "@/lib/resume/profile-mapper";
import { getTemplate } from "@/lib/resume/templates/registry";
import { tailorResume } from "@/lib/agents/resume-tailor";
import { fillTemplate, type TemplateFillResult } from "@/lib/agents/resume-template-fill";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { templateId, pageTarget, jdText } = parsed.data;

  // Load user bundle in parallel
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

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const profile = bundleToResumeProfile({
    user, settings, summaries, experiences, projects, education, certifications,
  });

  // Gate: minimum content before tailoring is allowed.
  // Addition E from the brief: PDF-only state should NOT pass this gate.
  const meetsGate =
    profile.header.fullName.trim().length > 0 &&
    profile.header.email.trim().length > 0 &&
    (profile.experiences.length > 0 || profile.projects.length > 0);
  if (!meetsGate) {
    return NextResponse.json(
      {
        error: "Profile incomplete. Add at least your name, email, and one experience or project.",
        code: "PROFILE_INCOMPLETE",
      },
      { status: 422 },
    );
  }

  let renderInput = buildRenderInput(profile, { templateId, pageTarget });

  // ── Phase 2: JD-aware tailoring via existing agent chain ───────────
  let fillResult: TemplateFillResult | null = null;
  const warnings: string[] = [];

  if (jdText && jdText.trim().length >= 20) {
    try {
      // Agent 2 (existing) — signal extraction
      const tailored = await tailorResume({
        userSkills: profile.skills,
        jobDescription: jdText,
        jobTitle: extractJobTitleFromJD(jdText) ?? "Unknown",
      });

      // Agent 5 (new) — template-aware ordering/selection
      fillResult = await fillTemplate({
        profile,
        tailored,
        templateId,
        pageTarget,
        jdText,
      });

      if (profile.skillsLocked && fillResult.missingHardSkills.length > 0) {
        warnings.push(
          `JD asks for ${fillResult.missingHardSkills.length} skills you don't have: ${fillResult.missingHardSkills.slice(0, 5).join(", ")}${fillResult.missingHardSkills.length > 5 ? "…" : ""}`,
        );
      }

      renderInput = applyRanking(renderInput, profile, {
        skillsOrder: fillResult.skillsOrder,
        projectIds: fillResult.projectIds,
        summaryId: fillResult.summaryId,
        sectionOrder: fillResult.sectionOrder,
      });
    } catch (err) {
      warnings.push(
        `JD agent chain failed: ${err instanceof Error ? err.message : "unknown"}. Used default ordering.`,
      );
    }
  }

  // ── Render + audit ─────────────────────────────────────────────────
  let renderResult;
  try {
    renderResult = renderResume(renderInput);
  } catch (err) {
    if (err instanceof TemplateNotAvailableError) {
      return NextResponse.json({ error: err.message, code: "TEMPLATE_NOT_AVAILABLE" }, { status: 400 });
    }
    if (err instanceof FabricationError) {
      console.error("[resume.generate] Fabrication audit failed:", err.fabricated);
      return NextResponse.json(
        { error: "Internal audit rejected output. Please report — generation aborted to protect you.", code: "AUDIT_FAIL" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 },
    );
  }

  // ── Persist generation row ─────────────────────────────────────────
  const generation = await prisma.resumeGeneration.create({
    data: {
      userId,
      templateId: renderResult.templateId,
      templateVersion: renderResult.templateVersion,
      pageTarget: renderInput.pageTarget,
      htmlSnapshot: renderResult.html,
      jdSnippet: jdText?.slice(0, 4000) ?? null,
      matchedKeywords: fillResult?.matchedKeywords ?? [],
    },
  });

  const diff = fillResult
    ? buildDiff(profile, renderInput, fillResult)
    : null;

  return NextResponse.json({
    generationId: generation.id,
    templateId: renderResult.templateId,
    templateVersion: renderResult.templateVersion,
    pageTarget: renderInput.pageTarget,
    template: getTemplate(renderResult.templateId).name,
    previewUrl: `/api/resumes/generations/${generation.id}/preview`,
    pdfUrl: `/api/resumes/generations/${generation.id}/pdf`,
    diff,
    warnings,
  });
}

/**
 * Best-effort extract a job title from the first ~3 lines of a JD.
 * Used to feed Agent 2 (which needs a jobTitle). Returns null if nothing
 * resembling a title is found in the first lines — Agent 2 tolerates that.
 */
function extractJobTitleFromJD(jdText: string): string | null {
  const head = jdText.split(/\r?\n/).slice(0, 3).join(" ").trim();
  return head.length > 0 && head.length < 200 ? head : null;
}

interface Diff {
  matchedKeywords: string[];
  promotedSkills: string[];
  featuredProjects: string[];
  pickedSummaryLabel: string | null;
  sectionOrderChanged: boolean;
  missingHardSkills: string[];
}

function buildDiff(
  profile: ReturnType<typeof bundleToResumeProfile>,
  renderInput: ReturnType<typeof buildRenderInput>,
  fill: TemplateFillResult,
): Diff {
  const profileIdx = new Map(profile.skills.map((s, i) => [s, i]));
  const promotedSkills = renderInput.skills.filter((s, newIdx) => {
    const oldIdx = profileIdx.get(s);
    return oldIdx !== undefined && newIdx < oldIdx;
  });

  const featuredProjects = renderInput.projects.map((p) => p.title);

  const pickedSummaryLabel = fill.summaryId
    ? profile.summaries.find((s) => s.id === fill.summaryId)?.label ?? null
    : null;

  const defaultOrder: SectionKey[] = ["summary", "skills", "experience", "projects", "education"];
  const sectionOrderChanged =
    JSON.stringify(renderInput.sectionOrder) !== JSON.stringify(defaultOrder);

  return {
    matchedKeywords: fill.matchedKeywords,
    promotedSkills,
    featuredProjects,
    pickedSummaryLabel,
    sectionOrderChanged,
    missingHardSkills: fill.missingHardSkills,
  };
}
