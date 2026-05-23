/**
 * POST /api/resumes/recommend-existing
 *
 * Picks which of a user's existing resumes is the best match for a JD.
 *
 * Body: { jdText: string, globalJobId?: string }
 * Returns: { resumeId, resumeName, candidates: [{ score, matchedTerms, reason, ... }] }
 *
 * Scoring (zero LLM cost — pure text overlap):
 *   - +1 per JD token that appears in Resume.content (the full extracted resume text)
 *   - +3 per detectedSkill that matches a JD token (stronger signal than free-text overlap)
 *   - +2 per multi-word JD phrase ("machine learning", "Node.js") found verbatim in resume content
 *   - +2 if targetCategories includes the JD's inferred role family
 *   - +1 if the resume name suggests the role family
 *   - +0.5 soft boost for isDefault
 *
 * Tokenization improvements over the previous detectedSkills-only matcher:
 *   - tokens drawn from the entire resume content, not the (often sparse) detectedSkills column
 *   - 100+ stopwords filtered so "the/and/with" don't inflate scores
 *   - alphanumeric + .#+/- preserved so "C++", "Node.js", "C#", "TypeScript" survive
 *   - multi-word phrases scored separately via substring scan
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { RecommendExistingResumeRequestSchema } from "@/lib/resume/types";

export const dynamic = "force-dynamic";

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

// Common English stopwords + recruiting filler. Keeps overlap signal honest.
const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","as","at",
  "be","because","been","before","being","below","between","both","but","by",
  "can","cannot","could",
  "did","do","does","doing","down","during",
  "each","every",
  "few","for","from","further",
  "had","has","have","having","he","her","here","hers","herself","him","himself","his","how",
  "i","if","in","into","is","it","its","itself",
  "just","let",
  "me","more","most","my","myself",
  "no","nor","not","now",
  "of","off","on","once","only","or","other","our","ours","ourselves","out","over","own",
  "same","she","should","so","some","such",
  "than","that","the","their","theirs","them","themselves","then","there","these","they","this","those","through","to","too",
  "under","until","up","us","use","used","using",
  "very",
  "was","we","were","what","when","where","which","while","who","whom","why","will","with","within","without","would",
  "yes","you","your","yours","yourself","yourselves",
  // Recruiting/JD filler
  "experience","work","working","role","team","skills","ability","strong","excellent","good","great","required","preferred",
  "looking","seeking","candidate","position","opportunity","company","years","year","minimum","plus","including",
  "responsibilities","requirements","qualifications","duties","etc","etc.",
]);

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
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+#./-]+/)
    .filter((t) => t.length >= 2 && t.length <= 40)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !/^\d+$/.test(t));
  return new Set(tokens);
}

// Extracts 2-3 word capitalized/dotted phrases from JD (e.g. "Machine Learning", "Node.js Express").
function extractPhrases(jd: string): string[] {
  const phrases = new Set<string>();
  const wordRe = /[A-Z][a-zA-Z0-9.+#-]*(?:\s+[A-Z][a-zA-Z0-9.+#-]*){1,2}/g;
  const matches = jd.match(wordRe) ?? [];
  for (const m of matches) {
    const lower = m.toLowerCase().trim();
    if (lower.length >= 5 && lower.length <= 40) phrases.add(lower);
  }
  return Array.from(phrases).slice(0, 25);
}

export async function POST(req: NextRequest) {
  const __auth = await requireAuthUserId();
  if (__auth.response) return __auth.response;
  const { userId } = __auth;

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
      content: true,
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
  const jdPhrases = extractPhrases(jdText);

  const scored = resumes.map((r) => {
    const resumeText = (r.content ?? "").toLowerCase();
    const resumeTokens = tokenize(r.content ?? "");

    const matchedTokens: string[] = [];
    jdTokens.forEach((t) => {
      if (resumeTokens.has(t)) matchedTokens.push(t);
    });
    const tokenOverlapScore = matchedTokens.length;

    const skillSet = new Set(r.detectedSkills.map((s) => s.toLowerCase()));
    const matchedSkills: string[] = [];
    skillSet.forEach((s) => {
      if (jdTokens.has(s)) matchedSkills.push(s);
    });
    const skillScore = matchedSkills.length * 3;

    const matchedPhrases: string[] = [];
    for (const phrase of jdPhrases) {
      if (resumeText.includes(phrase)) matchedPhrases.push(phrase);
    }
    const phraseScore = matchedPhrases.length * 2;

    const categoryHit =
      jdFamily && r.targetCategories.some((c) => c.toLowerCase().includes(jdFamily))
        ? 2
        : 0;

    const nameHit =
      jdFamily && ROLE_FAMILIES[jdFamily].some((kw) => r.name.toLowerCase().includes(kw))
        ? 1
        : 0;

    const defaultBoost = r.isDefault ? 0.5 : 0;

    const score = tokenOverlapScore + skillScore + phraseScore + categoryHit + nameHit + defaultBoost;

    const reasonParts: string[] = [];
    if (matchedSkills.length) reasonParts.push(`${matchedSkills.length} matched skills`);
    if (matchedTokens.length) reasonParts.push(`${matchedTokens.length} keyword overlaps`);
    if (matchedPhrases.length) reasonParts.push(`${matchedPhrases.length} phrase matches`);
    if (categoryHit) reasonParts.push(`category ${jdFamily} match`);
    if (nameHit) reasonParts.push(`name suggests ${jdFamily}`);
    if (defaultBoost) reasonParts.push("default resume");
    const reason = reasonParts.length ? reasonParts.join(" · ") : "no strong signal";

    const matchedTerms = Array.from(
      new Set([...matchedSkills, ...matchedPhrases, ...matchedTokens]),
    ).slice(0, 12);

    return {
      resumeId: r.id,
      resumeName: r.name,
      score: Number(score.toFixed(1)),
      matchedSkills: matchedSkills.slice(0, 12),
      matchedTerms,
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
