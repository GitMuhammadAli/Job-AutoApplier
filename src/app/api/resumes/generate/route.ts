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
import { requireAuthUserId } from "@/lib/auth";
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
import { QuotaExceededError, formatRetryMessage } from "@/lib/quota/quota";
import {
  parseUploadedPdfToProfile,
  pickBestUploadForParse,
  passesProfileGate,
} from "@/lib/resume/parse-uploaded-pdf";
import {
  computeKeywordCoverage,
  applyCoverageToRanking,
  type KeywordCoverageReport,
} from "@/lib/resume/keyword-coverage";

export const dynamic = "force-dynamic";
// AI parse-from-PDF fallback can run when no structured profile exists,
// adding ~5s to the worst-case path on top of tailor + fillTemplate.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const __auth = await requireAuthUserId(); if (__auth.response) return __auth.response; const userId = __auth.userId;

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

  let profile = bundleToResumeProfile({
    user, settings, summaries, experiences, projects, education, certifications,
  });

  // Track which source the profile came from so the UI can surface
  // "AI used your uploaded PDF" vs "used your saved profile".
  let profileSource: "structured" | "parsed-pdf" = "structured";
  let parsedFromResumeName: string | null = null;
  const sourceWarnings: string[] = [];

  // Gate: minimum content before tailoring is allowed.
  // If the structured profile doesn't meet the gate, try the parse-from-upload
  // fallback so users with only uploaded PDFs (no manual profile entry) can
  // still generate. This is the "AI auto-uses your existing resume" path.
  if (!passesProfileGate(profile)) {
    const bestUpload = await pickBestUploadForParse(userId);
    if (!bestUpload) {
      return NextResponse.json(
        {
          error:
            "No profile data found. Upload a resume PDF or fill in your structured profile to generate tailored resumes.",
          code: "NO_PROFILE_OR_UPLOADS",
        },
        { status: 422 },
      );
    }
    try {
      const parsed = await parseUploadedPdfToProfile(bestUpload.id, userId);
      if (!parsed.profile || !passesProfileGate(parsed.profile)) {
        return NextResponse.json(
          {
            error:
              `AI couldn't extract enough structure from "${bestUpload.name}". Try a different upload or fill in your profile manually.`,
            code: "PARSE_INCOMPLETE",
          },
          { status: 422 },
        );
      }
      profile = parsed.profile;
      profileSource = "parsed-pdf";
      parsedFromResumeName = parsed.resumeName;
      sourceWarnings.push(
        `Used your uploaded resume "${parsed.resumeName}" — AI extracted ${profile.experiences.length} experience(s) and ${profile.projects.length} project(s). Save to your profile so we don't re-extract every time.`,
      );
    } catch (err) {
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Failed to parse your uploaded resume",
          code: "PARSE_FAILED",
        },
        { status: 502 },
      );
    }
  }

  let renderInput = buildRenderInput(profile, { templateId, pageTarget });

  // ── Phase 2: JD-aware tailoring via existing agent chain ───────────
  let fillResult: TemplateFillResult | null = null;
  let coverage: KeywordCoverageReport | null = null;
  let forcedProjects: string[] = [];
  let forcedSkills: string[] = [];
  const warnings: string[] = [...sourceWarnings];

  if (jdText && jdText.trim().length >= 20) {
    try {
      // Agent 2 (existing) — signal extraction
      const tailored = await tailorResume({
        userSkills: profile.skills,
        jobDescription: jdText,
        jobTitle: extractJobTitleFromJD(jdText) ?? "Unknown",
        quota: { userId, route: "/api/resumes/generate" },
      });

      // Agent 5 (new) — template-aware ordering/selection
      fillResult = await fillTemplate({
        profile,
        tailored,
        templateId,
        pageTarget,
        jdText,
        quota: { userId, route: "/api/resumes/generate" },
      });

      if (profile.skillsLocked && fillResult.missingHardSkills.length > 0) {
        warnings.push(
          `JD asks for ${fillResult.missingHardSkills.length} skills you don't have: ${fillResult.missingHardSkills.slice(0, 5).join(", ")}${fillResult.missingHardSkills.length > 5 ? "…" : ""}`,
        );
      }

      // Deterministic post-pass: scan for JD keywords the user provably has
      // but that the LLM ranking would drop from the rendered PDF (the
      // WebRTC-rejection bug). Promote those projects/skills before applying.
      coverage = computeKeywordCoverage({
        profile,
        jdText,
        selectedProjectIds: fillResult.projectIds,
        selectedSkills: fillResult.skillsOrder,
      });

      const maxProjects =
        pageTarget === "unlimited"
          ? Number.MAX_SAFE_INTEGER
          : pageTarget === 2
            ? 5
            : 3;

      const promoted = applyCoverageToRanking(
        fillResult.projectIds,
        fillResult.skillsOrder,
        coverage,
        { maxProjects, maxSkills: 80 },
      );
      forcedProjects = promoted.forcedProjects;
      forcedSkills = promoted.forcedSkills;

      if (forcedProjects.length > 0 || forcedSkills.length > 0) {
        const promotedKeywords = coverage.inProfileNotPicked.slice(0, 5).join(", ");
        warnings.push(
          `Force-included ${forcedProjects.length} project(s) and ${forcedSkills.length} skill(s) to cover JD keywords you have${promotedKeywords ? `: ${promotedKeywords}` : ""}.`,
        );
      }

      if (coverage.missing.length > 0) {
        warnings.push(
          `${coverage.missing.length} JD keyword(s) aren't in your profile: ${coverage.missing.slice(0, 5).join(", ")}${coverage.missing.length > 5 ? "…" : ""}. Add them to your profile if accurate — we won't fabricate.`,
        );
      }

      renderInput = applyRanking(renderInput, profile, {
        skillsOrder: promoted.skills,
        projectIds: promoted.projectIds,
        summaryId: fillResult.summaryId,
        sectionOrder: fillResult.sectionOrder,
      });
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: "ai_quota_exceeded",
            reason: err.reason,
            message: formatRetryMessage(err.reason, err.retryAfterSeconds),
            retryAfterSeconds: err.retryAfterSeconds,
          },
          { status: 429 },
        );
      }
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
  // Encode "unlimited" as 0 so the Int column stays meaningful (1/2 = pages,
  // 0 = unlimited / multi-page CV).
  const pageTargetInt =
    renderInput.pageTarget === "unlimited" ? 0 : renderInput.pageTarget;
  const generation = await prisma.resumeGeneration.create({
    data: {
      userId,
      templateId: renderResult.templateId,
      templateVersion: renderResult.templateVersion,
      pageTarget: pageTargetInt,
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
    profileSource,
    parsedFromResumeName,
    coverage: coverage
      ? {
          covered: coverage.covered,
          inProfileNotPicked: coverage.inProfileNotPicked,
          missing: coverage.missing,
          coverageRatio: coverage.coverageRatio,
          forcedProjects,
          forcedSkills,
          // Per-missing-keyword adjacency: skills/projects the user has that
          // are semantically related. Empty array when no missing keyword
          // has any adjacent content in the profile. Lets the UI render an
          // honest "you have X — closest match" hint per ❌ chip.
          missingWithAdjacency: coverage.missingWithAdjacency,
        }
      : null,
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
