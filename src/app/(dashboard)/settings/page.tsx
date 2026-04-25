import { Suspense } from "react";
import Link from "next/link";
import { getSettings } from "@/app/actions/settings";
import { getResumeCount, getResumeSkills } from "@/app/actions/resume";
import { SettingsSkeleton } from "@/components/shared/Skeletons";
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
    <div className="space-y-5 animate-slide-up">
      {/* Static header — renders instantly */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 shadow-md shadow-slate-600/20">
            <Cog className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Settings</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Configure your profile, job preferences, automation behavior, and AI customization.
        </p>
      </div>

      {/* Diagnostics shortcut — surfaces silent scraper failures + API key
          gaps with one-click "How to fix" guides. Anyone seeing fewer jobs
          than expected lands here first. */}
      <Link
        href="/diagnostics/scrapers"
        className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-slate-200/60 dark:ring-zinc-700/50 p-3 hover:ring-blue-200 dark:hover:ring-blue-900/40 transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30 shrink-0">
            <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Scraper health
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
              Per-source status + how to fix each broken or quiet source
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 dark:text-zinc-500 dark:group-hover:text-blue-400 shrink-0" />
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
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <p className="text-sm text-slate-500 dark:text-zinc-400">Failed to load settings. Please try again.</p>
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
