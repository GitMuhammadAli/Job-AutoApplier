/**
 * POST /api/resumes/recommend-existing
 *
 * The lighter bonus feature mentioned by the user:
 *   "if user uploaded 8 [resumes] and some has more things according to the JD,
 *    JP will add a suggestion to use ABC resume according to the JD"
 *
 * Body: { jdText: string, globalJobId?: string }
 * Returns: { resumeId, resumeName, candidates: [{ score, matchedSkills, reason, ... }] }
 *
 * Scoring (zero LLM cost — pure data overlap):
 *   - +3 per detected-skill intersection with JD keywords
 *   - +2 if the resume's targetCategories includes the JD's inferred role family
 *   - +1 if the resume name suggests the role family ("Backend", "Frontend", "AI", ...)
 *   - The "isDefault" resume gets +0.5 as a soft tiebreaker
 *
 * Why no LLM: the user's existing Resume rows already carry `detectedSkills`
 * (populated at upload time by the resume-parser). We just intersect with JD
 * keywords. Cost-free, deterministic, explainable.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { RecommendExistingResumeRequestSchema } from "@/lib/resume/types";

export const dynamic = "force-dynamic";

// Common role-family keywords. Used both to detect the JD's family and
// to score resume-name hints.
const ROLE_FAMILIES = {
  frontend: ["frontend", "front-end", "react", "next.js", "vue", "angular", "ui", "ux"],
  backend: ["backend", "back-end", "nestjs", "node", "django", "fastapi", "express", "rails", "go"],
  fullstack: ["full stack", "full-stack", "fullstack", "mern", "mean"],
  ai: ["ai", "ml", "machine learning", "llm", "embeddings", "rag", "groq", "openai", "anthropic", "gemini", "pgvector"],
  mobile: ["ios", "android", "swift", "kotlin", "react native", "flutter"],
  devops: ["devops", "sre", "kubernetes", "docker", "terraform", "aws", "gcp", "azure"],
  data: ["data engineer", "etl", "snowflake", "dbt", "spark", "airflow"],
} as const;
type RoleFamily = keyof typeof ROLE_FAMILIES;

function detectFamily(text: string): RoleFamily | null {
  const lower = text.toLowerCase();
  let best: { family: RoleFamily; hits: number } | null = null;
  for (const family of Object.keys(ROLE_FAMILIES) as RoleFamily[]) {
    const hits = ROLE_FAMILIES[family].filter((kw) => lower.includes(kw)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { family, hits };
  }
  return best?.family ?? null;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/)
      .filter((t) => t.length >= 2),
  );
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RecommendExistingResumeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { jdText } = parsed.data;

  const resumes = await prisma.resume.findMany({
    where: { userId, isDeleted: false },
    select: {
      id: true,
      name: true,
      isDefault: true,
      detectedSkills: true,
      targetCategories: true,
    },
  });

  if (resumes.length === 0) {
    return NextResponse.json({
      resumeId: null,
      resumeName: null,
      candidates: [],
    });
  }

  const jdTokens = tokenize(jdText);
  const jdFamily = detectFamily(jdText);

  const scored = resumes.map((r) => {
    const skillTokens = Array.from(new Set(r.detectedSkills.map((s) => s.toLowerCase())));
    const matched = skillTokens.filter((s) => jdTokens.has(s));
    const skillScore = matched.length * 3;

    const categoryHit =
      jdFamily &&
      r.targetCategories.some((c) => c.toLowerCase().includes(jdFamily))
        ? 2
        : 0;

    const nameHit =
      jdFamily &&
      ROLE_FAMILIES[jdFamily].some((kw) => r.name.toLowerCase().includes(kw))
        ? 1
        : 0;

    const defaultBoost = r.isDefault ? 0.5 : 0;

    const score = skillScore + categoryHit + nameHit + defaultBoost;

    const reasonParts: string[] = [];
    if (matched.length) reasonParts.push(`${matched.length} matched skills`);
    if (categoryHit) reasonParts.push(`category ${jdFamily} match`);
    if (nameHit) reasonParts.push(`name suggests ${jdFamily}`);
    if (defaultBoost) reasonParts.push("default resume");
    const reason = reasonParts.length ? reasonParts.join(" · ") : "no strong signal";

    return {
      resumeId: r.id,
      resumeName: r.name,
      score,
      matchedSkills: matched.slice(0, 12),
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  return NextResponse.json({
    resumeId: top.score > 0 ? top.resumeId : null,
    resumeName: top.score > 0 ? top.resumeName : null,
    candidates: scored,
  });
}
