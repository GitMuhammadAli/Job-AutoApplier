/**
 * POST /api/resumes/profile/parse-pdf
 *
 * Input: { resumeId: string }   — existing JobPilot Resume (uploaded PDF)
 * Output: { candidate: ResumeProfile }  — AI-extracted candidate profile
 *
 * Critical contract: this endpoint NEVER saves anything. It returns a
 * candidate profile that the user reviews + confirms in the wizard, then
 * the wizard POSTs to PUT /api/resumes/profile to persist.
 *
 * AI's role here: pure extraction from the existing PDF text. No invention.
 * If the PDF text is missing fields, those come back empty — the user fills
 * them in the wizard.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { generateWithGroq } from "@/lib/groq";
import { ResumeProfileSchema } from "@/lib/resume/types";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  resumeId: z.string().min(1),
});

const SYSTEM_PROMPT = `You are a resume parser. Given the raw text of a resume, extract a STRICTLY structured JSON object with these fields:

{
  "header": {
    "fullName": string,
    "headline": string (e.g. "Software Engineer — Full Stack"),
    "location": string (optional),
    "email": string,
    "phone": string (optional),
    "websiteUrl": string (optional, must be https://),
    "githubUrl": string (optional, must be https://),
    "linkedinUrl": string (optional, must be https://)
  },
  "summary": string (the resume's professional summary, or empty),
  "skills": string[] (each skill ≤ 64 chars),
  "experiences": [
    {
      "company": string,
      "title": string,
      "location": string (optional),
      "startDate": string (e.g. "August 2025"),
      "endDate": string (e.g. "Present" or "August 2025", optional),
      "bullets": string[] (each ≤ 280 chars; EXACT bullets from the resume, do NOT rewrite or summarize)
    }
  ],
  "projects": [
    {
      "title": string,
      "role": string (optional, e.g. "Solo"),
      "oneLiner": string (≤ 200 chars),
      "bullets": string[] (≤ 280 chars each, EXACT from resume),
      "stack": string[] (tech tags),
      "liveUrl": string (optional, https://),
      "repoUrl": string (optional, https://)
    }
  ],
  "education": [
    {
      "institution": string,
      "degree": string,
      "startDate": string (optional),
      "endDate": string (optional),
      "details": string (optional, ≤ 400 chars)
    }
  ],
  "certifications": [
    {
      "name": string,
      "issuer": string (optional),
      "issuedDate": string (optional),
      "credentialUrl": string (optional, https://)
    }
  ]
}

HARD RULES:
- Do NOT invent skills, projects, experiences, or any text that isn't in the source.
- Do NOT rewrite or paraphrase bullets — copy them verbatim.
- If a field isn't in the source, use empty string or omit (per the schema).
- Return ONLY the JSON object, no prose, no markdown fence.`;

interface ParsedCandidate {
  header: {
    fullName: string;
    headline: string;
    location?: string;
    email: string;
    phone?: string;
    websiteUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
  };
  summary?: string;
  skills: string[];
  experiences: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    bullets: string[];
  }>;
  projects: Array<{
    title: string;
    role?: string;
    oneLiner: string;
    bullets: string[];
    stack: string[];
    liveUrl?: string;
    repoUrl?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    startDate?: string;
    endDate?: string;
    details?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string;
    issuedDate?: string;
    credentialUrl?: string;
  }>;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  // Authorize: resume must belong to the user
  const resume = await prisma.resume.findFirst({
    where: { id: parsed.data.resumeId, userId, isDeleted: false },
  });
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }
  if (!resume.content || resume.content.length < 100) {
    return NextResponse.json(
      { error: "Resume has no extractable text. Try re-parsing the PDF first." },
      { status: 422 },
    );
  }

  let raw: string;
  try {
    raw = await generateWithGroq(
      SYSTEM_PROMPT,
      `Resume text:\n\n${resume.content.slice(0, 12_000)}`,
      { temperature: 0.1, max_tokens: 2000 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Best-effort JSON extraction (Groq sometimes adds ```json ... ``` fences)
  const jsonText = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? raw;
  let candidate: ParsedCandidate;
  try {
    candidate = JSON.parse(jsonText.trim());
  } catch {
    return NextResponse.json(
      { error: "AI returned non-JSON output. Try again or fill manually." },
      { status: 502 },
    );
  }

  // Shape into our ResumeProfile schema (clamp string lengths defensively, drop garbage)
  const summaries = candidate.summary
    ? [
        {
          label: "Default",
          content: candidate.summary.slice(0, 600),
          isDefault: true,
        },
      ]
    : [];

  const shaped = {
    header: candidate.header,
    skills: (candidate.skills ?? []).map((s) => s.slice(0, 64)).slice(0, 80),
    skillsLocked: false,
    summaries,
    experiences: (candidate.experiences ?? []).map((e, idx) => ({
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: (e.bullets ?? []).map((b) => b.slice(0, 280)).slice(0, 8),
      order: idx,
    })),
    projects: (candidate.projects ?? []).map((p, idx) => ({
      title: p.title,
      role: p.role,
      oneLiner: (p.oneLiner ?? "").slice(0, 200),
      bullets: (p.bullets ?? []).map((b) => b.slice(0, 280)).slice(0, 6),
      stack: (p.stack ?? []).map((s) => s.slice(0, 64)).slice(0, 20),
      liveUrl: p.liveUrl,
      repoUrl: p.repoUrl,
      isFeatured: false,
      order: idx,
    })),
    education: (candidate.education ?? []).map((e, idx) => ({
      institution: e.institution,
      degree: e.degree,
      startDate: e.startDate,
      endDate: e.endDate,
      details: e.details,
      order: idx,
    })),
    certifications: (candidate.certifications ?? []).map((c, idx) => ({
      name: c.name,
      issuer: c.issuer,
      issuedDate: c.issuedDate,
      credentialUrl: c.credentialUrl,
      order: idx,
    })),
  };

  // Validate through Zod — fields that fail get reported so user can correct in wizard
  const validation = ResumeProfileSchema.safeParse(shaped);
  if (!validation.success) {
    return NextResponse.json(
      {
        candidate: shaped, // return raw so wizard can show + let user fix
        warnings: validation.error.issues.slice(0, 10),
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ candidate: validation.data });
}
