/**
 * POST /api/resumes/generate
 *
 * Body: { templateId?, pageTarget?, variantId?, jdText? }
 *
 * Renders the user's profile to HTML, runs the anti-fabrication audit,
 * persists a ResumeGeneration row (including htmlSnapshot for stream-on-demand
 * regen), and returns { generationId, html, previewUrl, diff }.
 *
 * Phase 2: when jdText is present, the JD ranker is invoked. We reorder
 * skills, pick top projects by stack overlap, pick best-matching summary,
 * and choose section order. The render input never gains a field the user
 * didn't enter — the audit pass enforces this on every generation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { GenerateRequestSchema } from "@/lib/resume/types";
import { renderResume, TemplateNotAvailableError } from "@/lib/resume/render";
import { FabricationError } from "@/lib/resume/audit";
import { buildRenderInput, toResumeProfile } from "@/lib/resume/profile-mapper";
import { getTemplate } from "@/lib/resume/templates/registry";
import { rankForJd, applyRankingToRenderInput, type RankForJdResult } from "@/lib/resume/jd-ranker";

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
  const { templateId, pageTarget, variantId, jdText } = parsed.data;

  const profileRow = await prisma.resumeProfile.findUnique({
    where: { userId },
    include: {
      summaries: true,
      experiences: true,
      projects: true,
      education: true,
      certifications: true,
    },
  });
  if (!profileRow) {
    return NextResponse.json(
      { error: "No resume profile. Run onboarding first at /dashboard/resumes/setup." },
      { status: 404 },
    );
  }
  if (parsed.data.profileId && parsed.data.profileId !== profileRow.id) {
    return NextResponse.json({ error: "Profile mismatch" }, { status: 403 });
  }

  let variant = null;
  if (variantId) {
    variant = await prisma.resumeVariant.findFirst({
      where: { id: variantId, profileId: profileRow.id },
    });
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
  }

  const profile = toResumeProfile(profileRow);
  let renderInput = buildRenderInput(profile, {
    templateId,
    pageTarget,
    variant,
  });

  // ── Phase 2: JD-aware tailoring ────────────────────────────────────
  let ranking: RankForJdResult | null = null;
  let warnings: string[] = [];

  if (jdText && jdText.trim().length >= 20 && !variantId) {
    try {
      const maxProjects = pageTarget === 2 ? 5 : 3;
      ranking = await rankForJd(profile, jdText, { maxProjects });

      // If the profile is skills-locked AND the JD requires skills the user
      // doesn't have, warn — but don't block. The user can still generate
      // (we just won't surface those skills) and decide whether to add them
      // to their master list.
      if (profile.skillsLocked && ranking.missingHardSkills.length > 0) {
        warnings.push(
          `JD asks for ${ranking.missingHardSkills.length} skills you don't have on your profile: ${ranking.missingHardSkills.slice(0, 5).join(", ")}${ranking.missingHardSkills.length > 5 ? "…" : ""}`,
        );
      }

      renderInput = applyRankingToRenderInput(renderInput, profile, ranking.ranking);
    } catch (err) {
      // If the ranker fails (LLM down / both providers exhausted), degrade
      // gracefully — render the profile in its default order with a warning.
      warnings.push(
        `JD ranker failed: ${err instanceof Error ? err.message : "unknown"}. Used default ordering.`,
      );
    }
  }

  // ── Render + audit ─────────────────────────────────────────────────
  let renderResult;
  try {
    renderResult = renderResume(renderInput);
  } catch (err) {
    if (err instanceof TemplateNotAvailableError) {
      return NextResponse.json(
        { error: err.message, code: "TEMPLATE_NOT_AVAILABLE" },
        { status: 400 },
      );
    }
    if (err instanceof FabricationError) {
      console.error("[resume.generate] Fabrication audit failed:", err.fabricated);
      return NextResponse.json(
        {
          error:
            "Internal audit rejected output. Please report this — generation aborted to protect you.",
          code: "AUDIT_FAIL",
        },
        { status: 500 },
      );
    }
    const msg = err instanceof Error ? err.message : "Render failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Persist generation ─────────────────────────────────────────────
  const generation = await prisma.resumeGeneration.create({
    data: {
      profileId: profileRow.id,
      variantId: variant?.id,
      templateId: renderResult.templateId,
      templateVersion: renderResult.templateVersion,
      pageTarget: renderInput.pageTarget,
      htmlSnapshot: renderResult.html,
      jdSnippet: jdText?.slice(0, 4000) ?? null,
      matchedKeywords: ranking?.ranking.matchedKeywords ?? [],
    },
  });

  // ── Diff for the preview sidebar ───────────────────────────────────
  const diff = ranking
    ? buildDiff(profile, renderInput, ranking)
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
    aiProvider: ranking?.provider ?? null,
  });
}

interface Diff {
  matchedKeywords: string[];
  promotedSkills: string[];
  featuredProjects: string[];
  pickedSummaryLabel: string | null;
  sectionOrderChanged: boolean;
  missingHardSkills: string[];
  roleFamily: string;
}

function buildDiff(
  profile: ReturnType<typeof toResumeProfile>,
  renderInput: ReturnType<typeof buildRenderInput>,
  ranking: RankForJdResult,
): Diff {
  // Promoted skills: any skill whose position in renderInput.skills is lower
  // than its position in profile.skills (i.e. moved up).
  const profileIdx = new Map(profile.skills.map((s, i) => [s, i]));
  const promotedSkills = renderInput.skills.filter((s, newIdx) => {
    const oldIdx = profileIdx.get(s);
    return oldIdx !== undefined && newIdx < oldIdx;
  });

  const featuredProjects = renderInput.projects.map((p) => p.title);

  const pickedSummaryLabel = ranking.ranking.summaryId
    ? profile.summaries.find((s) => s.id === ranking.ranking.summaryId)?.label ?? null
    : null;

  const defaultOrder = ["summary", "skills", "experience", "projects", "education"];
  const sectionOrderChanged =
    JSON.stringify(renderInput.sectionOrder) !== JSON.stringify(defaultOrder);

  return {
    matchedKeywords: ranking.ranking.matchedKeywords,
    promotedSkills,
    featuredProjects,
    pickedSummaryLabel,
    sectionOrderChanged,
    missingHardSkills: ranking.missingHardSkills,
    roleFamily: ranking.signal.roleFamily,
  };
}
