import { Suspense } from "react";
import Link from "next/link";
import { TrendingUp, ArrowLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import {
  analyzeOutcomes,
  classifyOutcome,
  type ApplicationOutcomeRow,
} from "@/lib/resume/outcome-analytics";
import { OutcomesClient } from "./client";

export const dynamic = "force-dynamic";

/**
 * "What's working" — outcome analytics across the user's sent applications.
 * Derives positive/negative outcomes from UserJob.stage; joins to
 * JobApplication.resumeGenerationId to slice by template + coverage.
 *
 * Pure read-only. Doesn't write outcome tags to the DB; if the user later
 * moves a job from INTERVIEW back to APPLIED, the next page render reflects
 * that automatically. No state to drift.
 */
export default function OutcomesPage() {
  return (
    <div className="space-y-4 animate-slide-up">
      <header>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
              <TrendingUp size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              What&apos;s working
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
          Callback rate by template + ATS coverage across your sent
          applications. Lets you double down on what converts and drop
          what doesn&apos;t.
        </p>
      </header>

      <Suspense fallback={<OutcomesSkeleton />}>
        <OutcomesServer />
      </Suspense>
    </div>
  );
}

async function OutcomesServer() {
  const userId = await getAuthUserId();

  // Pull every sent application + its UserJob stage + linked ResumeGeneration
  // metadata. Cap at 500 to bound the analysis cost — for jobless users we
  // expect ≤ 100 typical; the cap is a safety net.
  const apps = await prisma.jobApplication.findMany({
    where: { userId, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    take: 500,
    select: {
      id: true,
      userJobId: true,
      sentAt: true,
      userJob: { select: { stage: true } },
      resumeGeneration: {
        select: { templateId: true, matchedKeywords: true },
      },
    },
  });

  if (apps.length === 0) {
    return (
      <EmptyState
        title="No sent applications yet"
        body="Once you send applications via the Tailor & Apply flow (or auto-apply), this view will show which templates and ATS coverage levels get you callbacks."
      />
    );
  }

  const rows: ApplicationOutcomeRow[] = apps.map((a) => ({
    applicationId: a.id,
    userJobId: a.userJobId,
    stage: a.userJob.stage,
    outcome: classifyOutcome(a.userJob.stage),
    templateId: a.resumeGeneration?.templateId ?? null,
    matchedKeywordCount: a.resumeGeneration?.matchedKeywords
      ? a.resumeGeneration.matchedKeywords.length
      : null,
    sentAt: a.sentAt,
  }));

  const analysis = analyzeOutcomes(rows);

  return <OutcomesClient analysis={analysis} />;
}

function OutcomesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="h-48 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 flex flex-col items-center text-center">
      <Sparkles className="text-zinc-300 mb-3" size={32} />
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">{body}</p>
    </div>
  );
}
