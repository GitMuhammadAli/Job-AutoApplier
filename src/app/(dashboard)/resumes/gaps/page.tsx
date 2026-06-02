import { Suspense } from "react";
import Link from "next/link";
import { Target, ArrowLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { bundleToResumeProfile } from "@/lib/resume/profile-mapper";
import { analyzeKeywordGaps, type KeywordGapAnalysis } from "@/lib/resume/keyword-gaps";
import { GapsClient } from "./client";

export const dynamic = "force-dynamic";
// LLM-free analysis but loops over up to 200 JDs in JS — give it room.
export const maxDuration = 30;

/**
 * Strategic gap view: the keywords blocking the MOST jobs in the user's
 * shortlist, ranked by impact. Lets the user invest in learning one
 * keyword that unlocks many jobs, instead of chasing per-JD.
 *
 * Scope of jobs analyzed:
 *   - All non-dismissed UserJob links (saved + recommended + applied)
 *   - Bounded to 200 most recent for runtime + relevance
 *   - JDs without descriptions are skipped (no signal)
 */
export default function KeywordGapsPage() {
  return (
    <div className="space-y-4 animate-slide-up">
      <header>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
              <Target size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Keyword Gaps
            </h1>
          </div>
          <Link
            href="/resumes"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ArrowLeft size={12} /> Back to Resumes
          </Link>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          What's missing from your profile across the jobs you're looking at.
          Fix the top one and you unlock dozens of applications at once.
        </p>
      </header>

      <Suspense fallback={<GapsSkeleton />}>
        <GapsServer />
      </Suspense>
    </div>
  );
}

async function GapsServer() {
  const userId = await getAuthUserId();

  // Load the user's structured profile + their job shortlist in parallel.
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

  if (!user) {
    return <EmptyState message="Account not found. Try signing out and back in." />;
  }

  const profile = bundleToResumeProfile({
    user, settings, summaries, experiences, projects, education, certifications,
  });

  if (userJobs.length === 0) {
    return (
      <EmptyState message="No saved or recommended jobs yet. Browse /recommended first — once you have a shortlist, we can show you what's blocking the most jobs." />
    );
  }

  // Build the user's "known terms" haystack for ATS lite coverage. Mirrors
  // what recommendation-engine.ts uses so signals are consistent.
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

  const analysis: KeywordGapAnalysis = analyzeKeywordGaps(
    jobs,
    profile,
    userKnownHaystack,
    userKnownSkills,
  );

  return <GapsClient analysis={analysis} />;
}

function GapsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="h-72 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 flex flex-col items-center text-center">
      <Sparkles className="text-zinc-300 mb-3" size={32} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md">{message}</p>
    </div>
  );
}
