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
  pickBestUploadsForParse,
  passesProfileGate,
} from "@/lib/resume/parse-uploaded-pdf";
import {
  computeKeywordCoverage,
  applyCoverageToRanking,
  auditCoverageAgainstHtml,
  findLostCoverageFromDrops,
  type KeywordCoverageReport,
} from "@/lib/resume/keyword-coverage";
import { RESUME_TAILORING } from "@/lib/messages";

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
  // still generate. Old behavior: try only the default upload — if THAT one
  // had no text (image-only PDF, broken extraction), the whole pipeline
  // failed with "Resume has no extractable text" and the user got stuck
  // even though they had 6 other uploads with content. New behavior: walk
  // the top 3 candidates (already filtered to content >= 100 chars +
  // textQuality not "empty"), try each, take the first one that yields a
  // structured profile.
  if (!passesProfileGate(profile)) {
    const candidates = await pickBestUploadsForParse(userId, 3);
    if (candidates.length === 0) {
      // Either user has no uploads at all, or every upload's textQuality
      // is "empty"/content too short. Different remediation per case so
      // we tell them what to do next.
      const anyUpload = await prisma.resume.findFirst({
        where: { userId, isDeleted: false },
        select: { id: true },
      });
      return NextResponse.json(
        {
          error: anyUpload
            ? RESUME_TAILORING.NO_PARSEABLE_UPLOADS
            : RESUME_TAILORING.NO_PROFILE_OR_UPLOADS,
          code: anyUpload ? "NO_PARSEABLE_UPLOADS" : "NO_PROFILE_OR_UPLOADS",
        },
        { status: 422 },
      );
    }

    let parseError: string | null = null;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        const parsed = await parseUploadedPdfToProfile(candidate.id, userId);
        if (parsed.profile && passesProfileGate(parsed.profile)) {
          profile = parsed.profile;
          profileSource = "parsed-pdf";
          parsedFromResumeName = parsed.resumeName;
          sourceWarnings.push(
            i === 0
              ? RESUME_TAILORING.USED_UPLOADED_PROFILE(parsed.resumeName)
              : RESUME_TAILORING.TRIED_MULTIPLE_UPLOADS(parsed.resumeName, i + 1),
          );
          parseError = null;
          break;
        }
        // Profile parsed but failed gate — keep the last error for the
        // user, but try the next candidate.
        parseError = RESUME_TAILORING.PARSE_INCOMPLETE(candidate.name);
      } catch (err) {
        parseError = err instanceof Error ? err.message : RESUME_TAILORING.PARSE_FAILED;
        // Try the next candidate; only surface the error if ALL fail.
        continue;
      }
    }

    if (profileSource !== "parsed-pdf") {
      // None of the candidates yielded a usable profile. Tell the user
      // how many we tried + what to do next.
      return NextResponse.json(
        {
          error: RESUME_TAILORING.ALL_UPLOADS_FAILED(candidates.length),
          code: "ALL_UPLOADS_FAILED",
          lastError: parseError,
        },
        { status: 422 },
      );
    }
  }

  let renderInput = buildRenderInput(profile, { templateId, pageTarget });

  // ── Phase 2: JD-aware tailoring via existing agent chain ───────────
  let fillResult: TemplateFillResult | null = null;
  let coverage: KeywordCoverageReport | null = null;
  let forcedProjects: string[] = [];
  let forcedSkills: string[] = [];
  // Keywords previously covered by the LLM's pick that were silently
  // bumped off the PDF when force-include prepended new items beyond the
  // page cap. Caller surfaces these so the user can decide whether to
  // bump page-target instead of paying the trade.
  let lostFromForceInclude: string[] = [];
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
        warnings.push(
          RESUME_TAILORING.KEYWORDS_KEPT(
            forcedProjects.length,
            forcedSkills.length,
            coverage.inProfileNotPicked,
          ),
        );
      }

      // Trade-off detection: did force-include push another project past
      // the page cap, costing us coverage elsewhere? If yes, the user
      // probably wants to bump to 2 pages rather than pay the silent loss.
      if (promoted.droppedProjects.length > 0 || promoted.droppedSkills.length > 0) {
        lostFromForceInclude = findLostCoverageFromDrops(
          coverage,
          promoted.droppedProjects,
          promoted.droppedSkills,
          promoted.projectIds,
          promoted.skills,
        );
        if (lostFromForceInclude.length > 0 && pageTarget === 1) {
          warnings.push(
            RESUME_TAILORING.KEYWORDS_LOST_TO_PAGE(
              lostFromForceInclude.length,
              lostFromForceInclude,
            ),
          );
        }
      }

      if (coverage.missing.length > 0) {
        warnings.push(
          RESUME_TAILORING.MISSING_FROM_PROFILE(coverage.missing.length, coverage.missing),
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
      warnings.push(RESUME_TAILORING.AGENT_CHAIN_FALLBACK);
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
      // Surface the specific words that failed the audit so the client can
      // offer a 1-tap "Add these to my profile" action. Previous behaviour
      // returned a generic message, leaving the user stuck.
      return NextResponse.json(
        {
          error: RESUME_TAILORING.AUDIT_BLOCKED,
          code: "AUDIT_FAIL",
          // Capped — the audit can flag 50+ words on a bad render and we
          // don't want to dump a wall of text into the toast. Top 8 covers
          // the actionable cases.
          fabricated: err.fabricated.slice(0, 8),
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : RESUME_TAILORING.RENDER_FALLBACK_GENERIC },
      { status: 500 },
    );
  }

  // ── Post-render coverage audit ─────────────────────────────────────
  // The coverage report above is a CLAIM — it's based on which sources
  // (projects/skills) the agent picked. The render pipeline can later trim
  // content (1pg page-fit), templates can hide sections in narrow layouts,
  // and font replacements can break glyphs. The only honest signal of
  // "did this keyword actually land on the PDF" is grepping the rendered
  // HTML itself. notLanded entries get surfaced so the user can choose to
  // bump page-target or pick a different template.
  let auditNotLanded: string[] = [];
  if (coverage) {
    const claimed = Array.from(
      new Set([...coverage.covered, ...coverage.inProfileNotPicked]),
    );
    const audit = auditCoverageAgainstHtml(renderResult.html, claimed);
    auditNotLanded = audit.notLanded;
    if (auditNotLanded.length > 0) {
      warnings.push(
        RESUME_TAILORING.KEYWORDS_NOT_RENDERED(auditNotLanded.length, auditNotLanded),
      );
    }
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
          // Post-render integrity check: keywords the report CLAIMED would
          // land but that grepping the rendered HTML proves didn't (template
          // hid the section, page-fit trimmed, etc). The honest signal.
          auditNotLanded,
          // Trade-off: keywords previously covered by the LLM's pick that
          // got bumped off the PDF when force-include prepended new items.
          // UI shows a "Use 2 pages to keep both" prompt when non-empty.
          lostFromForceInclude,
          // Whether the trade-off can be resolved by switching to 2pg.
          // The UI uses this to gate the "Use 2 pages" CTA — no point
          // showing it if the user already chose 2pg (cap is wider) or
          // unlimited.
          pageBumpRecommended:
            lostFromForceInclude.length > 0 && renderInput.pageTarget === 1,
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
