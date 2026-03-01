import { Suspense } from "react";
import { getJobs, getTodaysQueue } from "@/app/actions/job";
import { getSettingsLite } from "@/app/actions/settings";
import { getDeliveryStats } from "@/app/actions/analytics";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { BulkActionsBar } from "@/components/dashboard/BulkActionsBar";
import { TodaysQueue } from "@/components/dashboard/TodaysQueue";
import { DeliveryStats } from "@/components/dashboard/DeliveryStats";
import { KanbanSkeleton } from "@/components/shared/Skeletons";
import { Zap, Clock, Mail, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import nextDynamic from "next/dynamic";

const OnboardingWizard = nextDynamic(
  () => import("@/components/onboarding/OnboardingWizard").then((m) => m.OnboardingWizard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    ),
  },
);

export default async function DashboardPage() {
  // Settings load first — fast query, needed for onboarding gate
  const settings = await getSettingsLite().catch(() => null);

  if (!settings) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-8 text-center">
        <h3 className="text-base font-bold text-red-800 dark:text-red-200">
          Failed to load dashboard
        </h3>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          We couldn&apos;t load your settings. Please refresh the page or try
          again later.
        </p>
      </div>
    );
  }

  if (!settings.isOnboarded) {
    return (
      <div className="animate-slide-up">
        <OnboardingWizard />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Client component — self-fetches via SWR, renders instantly */}
      <StatusBanner />

      {/* Static header — renders instantly */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            My Jobs
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Organize your job search — drag cards between stages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href="/jobs/new"
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-2.5 sm:px-3 py-1.5 text-white transition-colors touch-manipulation shadow-sm shrink-0"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold">Add Job</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 px-2 sm:px-2.5 py-1.5 shrink-0" title="We search 8 job sites every hour for new matches">
            <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-zinc-300">
              Auto-search
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 ring-1 ring-emerald-100 dark:ring-emerald-900/40 shrink-0" title="We write a personalized email for each job we find">
            <Mail className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Email per job
            </span>
          </div>
        </div>
      </div>

      {/* Widgets stream independently */}
      <Suspense fallback={<WidgetsSkeleton />}>
        <DashboardWidgets />
      </Suspense>

      {/* Kanban streams independently */}
      <Suspense fallback={<KanbanSkeleton />}>
        <DashboardKanban settings={settings} />
      </Suspense>
    </div>
  );
}

// ── Async: TodaysQueue + DeliveryStats ──
async function DashboardWidgets() {
  const [todaysQueue, deliveryStats] = await Promise.all([
    getTodaysQueue().catch(() => ({ autoApply: [], quickApply: [], total: 0 })),
    getDeliveryStats().catch(() => null),
  ]);

  if (todaysQueue.total === 0 && !deliveryStats) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {todaysQueue.total > 0 && (
        <TodaysQueue
          autoApply={todaysQueue.autoApply as any}
          quickApply={todaysQueue.quickApply as any}
          total={todaysQueue.total}
        />
      )}
      {deliveryStats && <DeliveryStats stats={deliveryStats} />}
    </div>
  );
}

// ── Async: Kanban board + bulk actions ──
async function DashboardKanban({ settings }: { settings: any }) {
  const jobs = await getJobs(settings).catch(() => []);

  const todayJobs = jobs.filter((j: any) => {
    const d = new Date(j.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <>
      {todayJobs > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2 sm:px-2.5 py-1.5 ring-1 ring-blue-100 dark:ring-blue-900/40 w-fit">
          <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
            {todayJobs} found today
          </span>
        </div>
      )}

      <BulkActionsBar jobCount={jobs.length} />

      {jobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 p-8 md:p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/40 dark:to-violet-950/40 ring-1 ring-blue-100/50 dark:ring-blue-800/30">
            <Zap className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
            Searching for jobs matching your keywords
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            New jobs usually appear within a few minutes. We&apos;re searching 8 job sites for you.
          </p>
          <div className="mt-4 inline-block rounded-lg bg-slate-50 dark:bg-zinc-800/50 px-4 py-3 text-left text-xs text-slate-600 dark:text-zinc-300 space-y-1">
            {settings.keywords && settings.keywords.length > 0 && (
              <p><strong>Keywords:</strong> {settings.keywords.slice(0, 6).join(", ")}{settings.keywords.length > 6 ? ` +${settings.keywords.length - 6} more` : ""}</p>
            )}
            {(settings.city || settings.country) && (
              <p><strong>Location:</strong> {[settings.city, settings.country].filter(Boolean).join(", ")}</p>
            )}
            {(!settings.keywords || settings.keywords.length === 0) && (
              <p className="text-amber-600 dark:text-amber-400">No keywords set — <Link href="/settings" className="underline">add some in Settings</Link></p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link
              href="/settings"
              className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors touch-manipulation"
            >
              Adjust Settings
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
    </>
  );
}

function WidgetsSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
      <div className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
    </div>
  );
}
