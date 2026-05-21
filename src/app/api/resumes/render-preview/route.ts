/**
 * POST /api/resumes/render-preview
 *
 * Renders a ResumeProfile to HTML WITHOUT persisting a ResumeGeneration row.
 * Used by the Overleaf-style /resumes/editor's right-pane live preview.
 *
 * Differences from /api/resumes/generate:
 *   - No DB write — safe to call every keystroke (with debounce).
 *   - Accepts a full ResumeProfile inline (unsaved state) instead of
 *     loading from the DB. This is what lets the preview reflect edits
 *     the user hasn't saved yet.
 *   - Optional jdText (Phase 2 ranker still runs).
 *
 * Audit pass still runs on every render — fabrication protection survives.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import {
  ResumeProfileSchema,
  type ResumeProfile,
} from "@/lib/resume/types";
import { buildRenderInput } from "@/lib/resume/profile-mapper";
import { renderResume, TemplateNotAvailableError } from "@/lib/resume/render";
import { FabricationError } from "@/lib/resume/audit";
import { rankForJd, applyRankingToRenderInput } from "@/lib/resume/jd-ranker";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  profile: ResumeProfileSchema,
  templateId: z.string().default("T01"),
  pageTarget: z.union([z.literal(1), z.literal(2)]).default(1),
  jdText: z.string().max(20_000).optional(),
});

export async function POST(req: NextRequest) {
  // Auth — same as /generate. Required to keep this endpoint from being
  // a public render service.
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

  const { profile, templateId, pageTarget, jdText } = parsed.data;

  // Profile arrived from the editor with `id` fields possibly missing for
  // newly-added rows. Mint synthetic ids so the render input stays typed.
  const stamped: ResumeProfile = stampIds(profile);

  let renderInput = buildRenderInput(stamped, { templateId, pageTarget });

  if (jdText && jdText.trim().length >= 20) {
    try {
      const maxProjects = pageTarget === 2 ? 5 : 3;
      const ranking = await rankForJd(stamped, jdText, { maxProjects });
      renderInput = applyRankingToRenderInput(renderInput, stamped, ranking.ranking);
    } catch {
      // Live preview falls back silently to default order on ranker failure.
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

/**
 * Newly-added items in the editor don't have an id yet. The render input
 * type requires `sourceId` strings, so we synthesize them here. The audit
 * pass doesn't care about ids — only visible text.
 */
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
