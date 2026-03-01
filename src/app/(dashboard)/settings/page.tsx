import { Suspense } from "react";
import { getSettings } from "@/app/actions/settings";
import { getResumeCount, getResumeSkills } from "@/app/actions/resume";
import { SettingsSkeleton } from "@/components/shared/Skeletons";
import nextDynamic from "next/dynamic";
import { Cog, Loader2 } from "lucide-react";

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
