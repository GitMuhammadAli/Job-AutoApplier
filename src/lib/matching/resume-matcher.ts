import { prisma } from "@/lib/prisma";
import { extractSkillsFromContent } from "@/lib/skill-extractor";
import { generateWithGroq } from "@/lib/groq";

interface JobLike {
  title: string;
  description: string | null;
  skills: string[];
  category: string | null;
  location: string | null;
}

export interface ResumeRow {
  id: string;
  name: string;
  content: string | null;
  isDefault: boolean;
  fileUrl: string | null;
  fileName: string | null;
  targetCategories: string[];
  detectedSkills: string[];
  updatedAt: Date;
}

type MatchTier = "category" | "skill" | "ai" | "fallback";

export interface ResumeMatchResult {
  resume: ResumeRow;
  tier: MatchTier;
  reason: string;
}

export async function pickBestResume(
  userId: string,
  job: JobLike
): Promise<ResumeRow | null> {
  const result = await pickBestResumeWithTier(userId, job);
  return result?.resume ?? null;
}

export async function pickBestResumeWithTier(
  userId: string,
  job: JobLike
): Promise<ResumeMatchResult | null> {
  const resumes: ResumeRow[] = await prisma.resume.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      content: true,
      isDefault: true,
      fileUrl: true,
      fileName: true,
      targetCategories: true,
      detectedSkills: true,
      updatedAt: true,
    },
  });

  if (resumes.length === 0) return null;
  if (resumes.length === 1) {
    return { resume: resumes[0], tier: "fallback", reason: "Only resume available" };
  }

  // ── German job detection ──
  const location = (job.location || "").toLowerCase();
  const isGermanJob =
    location.includes("germany") ||
    location.includes("deutschland") ||
    location.includes("german");

  if (isGermanJob) {
    const germanResume = resumes.find((r) => {
      const n = r.name.toLowerCase();
      return n.includes("german") || n.includes("deutsch");
    });
    if (germanResume) {
      return { resume: germanResume, tier: "category", reason: "German job → German resume" };
    }
  }

  // ── Tier 1: Category filter ──
  let candidates = resumes;
  if (job.category) {
    const categoryFiltered = resumes.filter((r) =>
      (r.targetCategories ?? []).some(
        (c) => c.toLowerCase() === job.category!.toLowerCase()
      )
    );
    if (categoryFiltered.length === 1) {
      return { resume: categoryFiltered[0], tier: "category", reason: `Category match: ${job.category}` };
    }
    if (categoryFiltered.length > 1) {
      candidates = categoryFiltered;
    }
  }

  // ── Tier 2: Skill scoring ──
  const jobText = `${job.title} ${job.description || ""}`.toLowerCase();
  const jobSkillsArr = job.skills ?? [];
  const jobSkills = jobSkillsArr.length > 0
    ? jobSkillsArr.map((s) => s.toLowerCase())
    : extractSkillsFromContent(jobText).map((s) => s.toLowerCase());

  const scored = candidates.map((resume) => {
    const resumeSkillSet = new Set(
      (resume.detectedSkills ?? []).map((s) => s.toLowerCase())
    );
    const contentSkills = extractSkillsFromContent(resume.content || "");
    for (const cs of contentSkills) resumeSkillSet.add(cs.toLowerCase());
    const resumeSkillArr = Array.from(resumeSkillSet);

    let hits = 0;
    for (const js of jobSkills) {
      if (resumeSkillSet.has(js)) {
        hits++;
      } else {
        for (const rs of resumeSkillArr) {
          if (rs.includes(js) || js.includes(rs)) {
            hits++;
            break;
          }
        }
      }
    }
    return { resume, score: hits };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored[0].score > 0 && scored.length >= 2) {
    const topScore = scored[0].score;
    const ties = scored.filter((s) => s.score === topScore);

    if (ties.length === 1) {
      return {
        resume: ties[0].resume,
        tier: "skill",
        reason: `Best skill match (${topScore} skills)`,
      };
    }

    // ── Tier 3: AI tiebreaker (only for 2-4 tied candidates) ──
    if (ties.length >= 2 && ties.length <= 4) {
      try {
        const aiResult = await aiTiebreaker(job, ties.map((t) => t.resume));
        if (aiResult) return aiResult;
      } catch {
        // AI unavailable — fall through
      }
    }

    return {
      resume: ties[0].resume,
      tier: "skill",
      reason: `Skill tie (${topScore} skills), picked first`,
    };
  }

  // ── Tier 4: Fallback chain ──
  const defaultResume = candidates.find((r) => r.isDefault);
  if (defaultResume) {
    return { resume: defaultResume, tier: "fallback", reason: "Default resume" };
  }

  const sorted = [...candidates].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
  return {
    resume: sorted[0] ?? candidates[0],
    tier: "fallback",
    reason: "Most recently updated resume",
  };
}

async function aiTiebreaker(
  job: JobLike,
  candidates: ResumeRow[]
): Promise<ResumeMatchResult | null> {
  const systemPrompt =
    "You are a resume-to-job matcher. Given a job and several resume summaries, respond ONLY with the number (1-based index) of the best-matching resume. No explanation.";

  const resumeSummaries = candidates
    .map(
      (r, i) =>
        `Resume ${i + 1}: "${r.name}" — Skills: ${(r.detectedSkills ?? []).slice(0, 15).join(", ") || "unknown"}. Categories: ${(r.targetCategories ?? []).join(", ") || "general"}.`
    )
    .join("\n");

  const userPrompt = `Job: "${job.title}" at category "${job.category || "general"}".\nRequired skills: ${(job.skills ?? []).slice(0, 15).join(", ") || "not specified"}.\n\n${resumeSummaries}\n\nBest resume number:`;

  const response = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.1,
    max_tokens: 10,
  });

  const match = response.match(/(\d+)/);
  if (match) {
    const idx = parseInt(match[1], 10) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return {
        resume: candidates[idx],
        tier: "ai",
        reason: `AI selected "${candidates[idx].name}"`,
      };
    }
  }

  return null;
}
