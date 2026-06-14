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
import { DevRadarBanner } from "@/components/dashboard/DevRadarBanner";
import { Zap, Clock, Mail, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { DASHBOARD } from "@/lib/messages";

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
  // Settings load first — fast query, needed for onboarding gate.
  // null here means EITHER no UserSettings row exists yet (brand-new OAuth user,
  // pre-onboarding) OR a real DB error. Both cases should land on onboarding —
  // a fresh user with no row should see the wizard, not a fatal error.
  const settings = await getSettingsLite().catch(() => null);

  if (!settings || !settings.isOnboarded) {
    // Pre-fill from any existing settings — saves re-entry for legacy users
    // and users whose OAuth provider gave us a name.
    return (
      <div className="animate-slide-up">
        <OnboardingWizard
          prefill={
            settings
              ? {
                  fullName: settings.fullName,
                  city: settings.city,
                  country: settings.country,
                  experienceLevel: settings.experienceLevel,
                  keywords: settings.keywords,
                  categories: settings.preferredCategories,
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Client component — self-fetches via SWR, renders instantly */}
      <StatusBanner />

      <DevRadarBanner />

      {/* Editorial header — generous breath, no clinical chrome */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
            Today
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Your job pipeline
          </h1>
          <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
            Drag cards between stages. New matches arrive automatically as scrapers run.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-white shadow-soft-md hover:shadow-soft-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] tap-44 focus-soft"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[12px] font-medium">Add job</span>
          </Link>
          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-stone-200/80 dark:border-stone-800/60 bg-white/60 dark:bg-stone-900/60 px-2.5 py-2"
            title="We search 8 job sites every hour for new matches"
          >
            <Clock className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
            <span className="text-[11px] font-medium text-stone-600 dark:text-stone-300">
              Auto-searching
            </span>
          </div>
          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-2 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40"
            title="We write a personalized email for each job we find"
          >
            <Mail className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
              Per-job email
            </span>
          </div>
        </div>
      </header>

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

  // When the user has nothing in motion yet — no queue, no delivery stats —
  // surface a clear next-step card instead of rendering nothing. A fresh
  // user on /dashboard with an empty board needs to know "go to
  // /recommended" not stare at a void.
  if (todaysQueue.total === 0 && !deliveryStats) {
    return <NextBestActionCard />;
  }

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

function NextBestActionCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-gradient-to-br from-emerald-50/40 via-stone-50/60 to-stone-50/40 dark:from-emerald-950/20 dark:via-stone-900/60 dark:to-stone-900/40 p-5 sm:p-6 shadow-soft-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-soft-md">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-stone-900 dark:text-stone-100">
            {DASHBOARD.NEXT_ACTION_TITLE}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">
            {DASHBOARD.NEXT_ACTION_BODY}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/recommended"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-[12px] font-medium shadow-soft-sm hover:shadow-soft-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] tap-44 focus-soft"
            >
              {DASHBOARD.NEXT_ACTION_PRIMARY}
              <Plus className="h-3 w-3" />
            </Link>
            <Link
              href="/resumes"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 px-3.5 py-2 text-[12px] font-medium hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors duration-300 tap-44 focus-soft"
            >
              {DASHBOARD.NEXT_ACTION_TAILOR}
            </Link>
            <Link
              href="/resumes/setup"
              className="text-[12px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
            >
              {DASHBOARD.NEXT_ACTION_SETUP}
            </Link>
          </div>
        </div>
      </div>
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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40 w-fit">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
          <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200 tabular-nums">
            {todayJobs} found today
          </span>
        </div>
      )}

      <BulkActionsBar jobCount={jobs.length} />

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300/70 dark:border-stone-700/60 bg-white/50 dark:bg-stone-900/50 p-8 md:p-12 text-center shadow-soft-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800/60 ring-1 ring-stone-200/60 dark:ring-stone-700/60">
            <Zap className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-[15px] font-medium text-stone-900 dark:text-stone-100">
            Searching for matches
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            New jobs usually appear within a few minutes — we're scanning 8 sources for your keywords.
          </p>
          <div className="mt-5 inline-block rounded-xl bg-stone-50/80 dark:bg-stone-800/50 px-4 py-3 text-left text-[12px] text-stone-600 dark:text-stone-300 space-y-1.5 border border-stone-200/60 dark:border-stone-800/60">
            {settings.keywords && settings.keywords.length > 0 && (
              <p>
                <span className="text-stone-400">Keywords ·</span>{" "}
                {settings.keywords.slice(0, 6).join(", ")}
                {settings.keywords.length > 6 ? ` +${settings.keywords.length - 6} more` : ""}
              </p>
            )}
            {(settings.city || settings.country) && (
              <p>
                <span className="text-stone-400">Location ·</span>{" "}
                {[settings.city, settings.country].filter(Boolean).join(", ")}
              </p>
            )}
            {(!settings.keywords || settings.keywords.length === 0) && (
              <p className="text-amber-700 dark:text-amber-300">
                No keywords set —{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  add some in Settings
                </Link>
              </p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-[12px]">
            <Link
              href="/settings"
              className="rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 px-3.5 py-2 font-medium text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 transition-colors duration-300 tap-44 focus-soft"
            >
              Adjust settings
            </Link>
            <Link
              href="/jobs/new"
              className="rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 px-3.5 py-2 font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors duration-300 tap-44 focus-soft"
            >
              Add job manually
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
      <div className="animate-pulse-soft rounded-2xl bg-stone-200/60 dark:bg-stone-800/60 h-32" />
      <div className="animate-pulse-soft rounded-2xl bg-stone-200/60 dark:bg-stone-800/60 h-32" />
    </div>
  );
}
