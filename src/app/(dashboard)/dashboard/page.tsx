import { getJobs } from "@/app/actions/job";
import { getSettings } from "@/app/actions/settings";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { Zap, Clock, Mail } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let jobs: Awaited<ReturnType<typeof getJobs>> = [];
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;

  try {
    [jobs, settings] = await Promise.all([getJobs(), getSettings()]);
  } catch (error) {
    console.error("[DashboardPage] Failed to load data:", error);
  }

  if (!settings || !settings.isOnboarded) {
    return (
      <div className="animate-slide-up">
        <OnboardingWizard />
      </div>
    );
  }

  const todayJobs = jobs.filter((j) => {
    const d = new Date(j.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-5 animate-slide-up">
      <StatusBanner />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Job Pipeline
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Drag cards between stages or use the arrows to move them.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 ring-1 ring-blue-100 dark:ring-blue-900/40">
            <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 tabular-nums">{todayJobs} found today</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
            <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">Auto scan</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 ring-1 ring-emerald-100 dark:ring-emerald-900/40">
            <Mail className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Email per job</span>
          </div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 p-8 md:p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/40 dark:to-violet-950/40 ring-1 ring-blue-100/50 dark:ring-blue-800/30">
            <Zap className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">Your job board is empty</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            Jobs are being fetched. Your first batch arrives within 30 minutes, or try these:
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link
              href="/settings"
              className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors touch-manipulation"
            >
              Broaden Keywords
            </Link>
            <Link
              href="/jobs/new"
              className="rounded-lg bg-slate-100 dark:bg-zinc-800 px-3 py-2 font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors touch-manipulation"
            >
              Add Job Manually
            </Link>
          </div>
        </div>
      ) : (
        <KanbanBoard initialJobs={jobs as any} />
      )}
    </div>
  );
}
