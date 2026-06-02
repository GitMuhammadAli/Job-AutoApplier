"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { bundleToResumeProfile } from "@/lib/resume/profile-mapper";
import { analyzeKeywordGaps } from "@/lib/resume/keyword-gaps";
import { SKILL_SUGGESTIONS_COPY } from "@/lib/messages";

export interface SkillSuggestion {
  /** The keyword as extracted from JDs — already lowercased. */
  keyword: string;
  /** How many of the analyzed jobs ask for it. */
  jobCount: number;
  /** True if the user has related (but distinct) experience in profile. */
  hasAdjacency: boolean;
  /** A short label suggesting why this matters. UI displays under the chip. */
  reason: string;
}

/**
 * Top missing keywords across the user's shortlist, presented as one-click
 * "add to skills" suggestions on the profile editor.
 *
 * Closes the loop where adding a skill feels invisible. With this, the user
 * sees "Adding Kubernetes unlocks 18 of your 50 jobs" before clicking — so
 * profile-strengthening feels like progress, not paperwork.
 *
 * Filters:
 *   - Drops keywords the user already has (current profile.skills).
 *   - Requires the keyword to block ≥ 2 jobs (single-job blockers are noisy).
 *   - Caps at `take` entries (default 8).
 *
 * Reuses analyzeKeywordGaps so noise filtering + alias expansion stay
 * consistent with /resumes/gaps. Cheap (no LLM, pure aggregation).
 */
export async function getSkillSuggestions(
  options: { take?: number; minJobCount?: number } = {},
): Promise<SkillSuggestion[]> {
  const { take = 8, minJobCount = 2 } = options;
  try {
    const userId = await getAuthUserId();

    const [user, settings, summaries, experiences, projects, education, certifications, userJobs, resumes] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
        prisma.userSettings.findUnique({ where: { userId } }),
        prisma.resumeSummary.findMany({ where: { userId } }),
        prisma.resumeExperience.findMany({ where: { userId } }),
        prisma.resumeProject.findMany({ where: { userId } }),
        prisma.resumeEducation.findMany({ where: { userId } }),
        prisma.resumeCertification.findMany({ where: { userId } }),
        prisma.userJob.findMany({
          where: { userId, isDismissed: false },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            globalJob: {
              select: { id: true, title: true, company: true, description: true, skills: true },
            },
          },
        }),
        prisma.resume.findMany({
          where: { userId, isDeleted: false },
          select: { content: true, detectedSkills: true },
        }),
      ]);

    if (!user || userJobs.length === 0) return [];

    const profile = bundleToResumeProfile({
      user, settings, summaries, experiences, projects, education, certifications,
    });

    // Build the same "known terms" haystack the gaps page uses so signals
    // are consistent across surfaces.
    const userKnownSkills = Array.from(
      new Set(
        [
          ...(settings?.keywords ?? []),
          ...resumes.flatMap((r) => r.detectedSkills ?? []),
          ...profile.skills,
        ]
          .map((s) => s.toLowerCase().trim())
          .filter(Boolean),
      ),
    );
    const userKnownHaystack = [
      ...(settings?.keywords ?? []),
      ...resumes.flatMap((r) => r.detectedSkills ?? []),
      ...resumes.map((r) => (r.content ?? "").slice(0, 8000)),
      ...profile.skills,
      ...profile.experiences.flatMap((e) => e.bullets ?? []),
      ...profile.projects.flatMap((p) => [...(p.bullets ?? []), ...(p.stack ?? [])]),
    ]
      .join(" \n ")
      .toLowerCase();

    const jobs = userJobs
      .filter((uj) => uj.globalJob)
      .map((uj) => ({
        id: uj.globalJob!.id,
        title: uj.globalJob!.title,
        company: uj.globalJob!.company,
        description: uj.globalJob!.description,
        skills: uj.globalJob!.skills ?? [],
      }));

    const analysis = analyzeKeywordGaps(jobs, profile, userKnownHaystack, userKnownSkills, {
      topN: 40, // pull a wider net before we filter
    });

    // The existing skill set, lowercase, for dedup. analyzeKeywordGaps already
    // excludes keywords matching the user's profile/haystack — but a user
    // might have skills in lower/upper case forms not in the haystack normalized
    // form, so we belt-and-suspenders here.
    const existingLower = new Set(
      profile.skills.map((s) => s.toLowerCase().trim()),
    );

    const suggestions: SkillSuggestion[] = [];
    for (const entry of analysis.entries) {
      if (suggestions.length >= take) break;
      if (entry.jobCount < minJobCount) continue;
      if (existingLower.has(entry.keyword)) continue;
      suggestions.push({
        keyword: entry.keyword,
        jobCount: entry.jobCount,
        hasAdjacency: entry.hasAdjacency,
        reason: entry.hasAdjacency
          ? SKILL_SUGGESTIONS_COPY.REASON_RELATED(entry.jobCount)
          : SKILL_SUGGESTIONS_COPY.REASON_COLD(entry.jobCount),
      });
    }

    return suggestions;
  } catch (err) {
    console.error("[skill-suggestions]", err);
    return [];
  }
}
