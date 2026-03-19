import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { generateWithGroq, streamWithGroq } from "@/lib/groq";
import { getSettings } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const body = await req.json();
    const { userJobId } = body;
    // Support ?stream=true query param OR body field { stream: true }
    const wantsStream =
      req.nextUrl.searchParams.get("stream") === "true" || body.stream === true;

    if (!userJobId || typeof userJobId !== "string") {
      return NextResponse.json({ error: "Missing userJobId" }, { status: 400 });
    }

    const [userJob, settings, defaultResume] = await Promise.all([
      prisma.userJob.findFirst({
        where: { id: userJobId, userId },
        include: {
          globalJob: {
            select: {
              title: true,
              company: true,
              location: true,
              description: true,
              skills: true,
              source: true,
            },
          },
        },
      }),
      getSettings().catch(() => null),
      prisma.resume.findFirst({
        where: { userId, isDeleted: false, isDefault: true },
        select: { detectedSkills: true, content: true },
      }),
    ]);

    if (!userJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const g = userJob.globalJob;
    const profileName = settings?.fullName || "the candidate";
    const expLevel = settings?.experienceLevel || "";
    const resumeSkills = defaultResume?.detectedSkills?.join(", ") || "";
    const jobSkills = (g.skills ?? []).join(", ");
    const descPreview = (g.description || "").slice(0, 1500);

    const jobContext = `JOB: ${g.title} at ${g.company}
Location: ${g.location || "Not specified"}
Skills needed: ${jobSkills || "Not listed"}
Description: ${descPreview || "No description available"}`;

    const candidateContext = `Candidate: ${profileName}${expLevel ? `, ${expLevel} level` : ""}
${resumeSkills ? `Skills: ${resumeSkills}` : ""}`;

    // ── Streaming branch ─────────────────────────────────────────────────────
    if (wantsStream) {
      const type = (body.type as string) || "cover_letter";
      let streamSystemPrompt: string;
      let streamUserPrompt: string;
      let max_tokens: number;

      if (type === "pitch") {
        streamSystemPrompt = `You are a job application pitch writer.
Write a SHORT pitch: exactly 3-4 sentences, under 80 words total.
Purpose: ATS form fields like "Why are you interested?" or "Tell us about yourself".
First sentence: who the candidate is (name, role, experience level).
Second/third: 2 specific qualifications matching this job.
Last sentence: why this specific company/role excites them.
No generic fluff. Be direct, specific, confident. No placeholder brackets.
Return ONLY the pitch text. No JSON. No markdown.`;
        streamUserPrompt = `${jobContext}

${candidateContext}

Write the pitch now.`;
        max_tokens = 200;
      } else {
        streamSystemPrompt = `You are an expert cover letter writer.
Write a concise cover letter (200-350 words).
Structure: Opening hook → 2 key qualifications → why this company → closing with call to action.
No generic phrases. Be specific to this job and this candidate.
No placeholder brackets — use the actual values provided.
Return ONLY the cover letter text. No JSON. No markdown.`;
        streamUserPrompt = `${jobContext}

${candidateContext}

Write the cover letter now.`;
        max_tokens = 600;
      }

      const stream = streamWithGroq(streamSystemPrompt, streamUserPrompt, {
        temperature: 0.7,
        max_tokens,
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // ── Non-streaming (original) branch ─────────────────────────────────────
    const systemPrompt = `You are a job application assistant. Generate TWO things for a candidate applying to a specific job.

1. PITCH: A short 3-4 sentence paragraph answering "Why are you interested in this role?" or "Tell us about yourself". Confident, specific to the job, mentioning 2-3 relevant skills. No generic fluff.

2. COVER_LETTER: A professional cover letter (150-200 words) tailored to this specific job. No placeholder brackets. Reference the company and role by name. Mention specific matching skills. Include a call to action.

The candidate's name is ${profileName}${expLevel ? `, ${expLevel} level` : ""}.
${resumeSkills ? `Their skills: ${resumeSkills}` : ""}

OUTPUT FORMAT - Return ONLY valid JSON, no markdown:
{"pitch":"...","coverLetter":"..."}`;

    const userPrompt = `${jobContext}

Generate the pitch and cover letter now.`;

    const raw = await generateWithGroq(systemPrompt, userPrompt, {
      temperature: 0.7,
      max_tokens: 1000,
    });

    let result: { pitch: string; coverLetter: string };
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      result = JSON.parse(cleaned);
    } catch {
      const pitchMatch = raw.match(/"pitch"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const clMatch = raw.match(/"coverLetter"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      result = {
        pitch: pitchMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') || "",
        coverLetter: clMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') || "",
      };
    }

    if (!result.pitch && !result.coverLetter) {
      return NextResponse.json({ error: "AI returned empty content" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[generate-pitch] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 },
    );
  }
}
