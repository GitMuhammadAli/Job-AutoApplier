import { getSettings } from "@/app/actions/settings";
import { getResumeCount } from "@/app/actions/resume";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { Cog } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  let resumeCount = 0;

  try {
    [settings, resumeCount] = await Promise.all([
      getSettings(),
      getResumeCount().catch(() => 0),
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
    <div className="space-y-5 animate-slide-up">
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
      <SettingsForm initialSettings={settings} resumeCount={resumeCount} />
    </div>
  );
}
