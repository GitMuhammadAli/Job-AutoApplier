/**
 * POST /api/resumes/render-preview
 *
 * Renders a ResumeProfile to HTML WITHOUT persisting a ResumeGeneration row.
 * Powers the live preview iframe in the Overleaf-style editor.
 *
 * Accepts inline profile (unsaved state) so preview reflects edits the user
 * hasn't saved yet. Optional jdText runs the agent chain (tailorResume →
 * fillTemplate). Audit pass still runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { ResumeProfileSchema, type ResumeProfile } from "@/lib/resume/types";
import { buildRenderInput, applyRanking } from "@/lib/resume/profile-mapper";
import { renderResume, TemplateNotAvailableError } from "@/lib/resume/render";
import { FabricationError } from "@/lib/resume/audit";
import { tailorResume } from "@/lib/agents/resume-tailor";
import { fillTemplate } from "@/lib/agents/resume-template-fill";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  profile: ResumeProfileSchema,
  templateId: z.string().default("T01"),
  pageTarget: z.union([z.literal(1), z.literal(2)]).default(1),
  jdText: z.string().max(20_000).optional(),
});

export async function POST(req: NextRequest) {
  await getAuthUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  const { profile: rawProfile, templateId, pageTarget, jdText } = parsed.data;
  const profile = stampIds(rawProfile);

  let renderInput = buildRenderInput(profile, { templateId, pageTarget });

  if (jdText && jdText.trim().length >= 20) {
    try {
      const tailored = await tailorResume({
        userSkills: profile.skills,
        jobDescription: jdText,
        jobTitle: jdText.split(/\r?\n/).slice(0, 2).join(" ").trim().slice(0, 200),
      });
      const fill = await fillTemplate({
        profile,
        tailored,
        templateId,
        pageTarget,
        jdText,
      });
      renderInput = applyRanking(renderInput, profile, {
        skillsOrder: fill.skillsOrder,
        projectIds: fill.projectIds,
        summaryId: fill.summaryId,
        sectionOrder: fill.sectionOrder,
      });
    } catch {
      // Silent fall-back in preview path; the user can still see the doc.
    }
  }

  try {
    const result = renderResume(renderInput);
    return new NextResponse(result.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof TemplateNotAvailableError) {
      return NextResponse.json(
        { error: err.message, code: "TEMPLATE_NOT_AVAILABLE" },
        { status: 400 },
      );
    }
    if (err instanceof FabricationError) {
      return NextResponse.json(
        { error: "Audit rejected output", code: "AUDIT_FAIL" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 },
    );
  }
}

/** Mint synthetic ids for unsaved rows so the render-input type stays clean. */
function stampIds(p: ResumeProfile): ResumeProfile {
  let counter = 0;
  const mint = () => `tmp_${++counter}`;
  return {
    ...p,
    summaries: p.summaries.map((s) => ({ ...s, id: s.id ?? mint() })),
    experiences: p.experiences.map((e) => ({ ...e, id: e.id ?? mint() })),
    projects: p.projects.map((pp) => ({ ...pp, id: pp.id ?? mint() })),
    education: p.education.map((e) => ({ ...e, id: e.id ?? mint() })),
    certifications: p.certifications.map((c) => ({ ...c, id: c.id ?? mint() })),
  };
}
