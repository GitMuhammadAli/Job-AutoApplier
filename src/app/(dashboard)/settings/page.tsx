import { Suspense } from "react";
import Link from "next/link";
import { getSettings } from "@/app/actions/settings";
import { getResumeCount, getResumeSkills } from "@/app/actions/resume";
import { SettingsSkeleton } from "@/components/shared/Skeletons";
import { AiUsageWidget } from "@/components/settings/AiUsageWidget";
import nextDynamic from "next/dynamic";
import { Cog, Loader2, Activity, ChevronRight } from "lucide-react";

const SettingsForm = nextDynamic(
  () => import("@/components/settings/SettingsForm").then((m) => m.SettingsForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    ),
  },
);

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-page-enter">
      {/* Editorial header */}
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
          Configuration
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-200 dark:ring-stone-700">
            <Cog className="h-4 w-4 text-stone-600 dark:text-stone-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Settings
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
          Profile, job preferences, automation behavior, and AI customization.
        </p>
      </header>

      {/* AI usage — daily token budget, honest "share remaining" messaging */}
      <AiUsageWidget />

      {/* Diagnostics shortcut */}
      <Link
        href="/diagnostics/scrapers"
        className="group flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/60 p-3.5 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-soft-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-soft"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50/80 dark:bg-amber-950/30 ring-1 ring-amber-200/50 dark:ring-amber-900/40 shrink-0">
            <Activity className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-stone-900 dark:text-stone-100">
              Scraper health
            </p>
            <p className="text-[12px] text-stone-500 dark:text-stone-400 truncate">
              Per-source status + one-click fixes
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-stone-600 dark:group-hover:text-stone-300 group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
      </Link>

      {/* Async data streams in */}
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  let resumeCount = 0;
  let resumeSkills: { skills: string[]; resumeNames: string[] } = { skills: [], resumeNames: [] };

  try {
    [settings, resumeCount, resumeSkills] = await Promise.all([
      getSettings(),
      getResumeCount().catch(() => 0),
      getResumeSkills().catch(() => ({ skills: [], resumeNames: [] })),
    ]);
  } catch (error) {
    console.error("[SettingsPage] Failed to load settings:", error);
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/60 dark:bg-stone-900/60 p-8">
        <p className="text-[13px] text-stone-500 dark:text-stone-400">
          We couldn't load your settings. Refresh to try again.
        </p>
      </div>
    );
  }

  return (
    <SettingsForm
      initialSettings={settings}
      resumeCount={resumeCount}
      resumeSkills={resumeSkills.skills}
      resumeNames={resumeSkills.resumeNames}
    />
  );
}
