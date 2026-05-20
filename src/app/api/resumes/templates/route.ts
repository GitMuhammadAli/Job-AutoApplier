/**
 * GET /api/resumes/templates
 *
 * Returns the template catalog (16 entries) for the UI picker.
 * Includes both available and coming-soon templates so users see the roadmap.
 */

import { NextResponse } from "next/server";
import { TEMPLATE_REGISTRY } from "@/lib/resume/templates/registry";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    templates: TEMPLATE_REGISTRY.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      audience: t.audience,
      layout: t.layout,
      atsRank: t.atsRank,
      available: t.available,
      version: t.version,
    })),
  });
}
