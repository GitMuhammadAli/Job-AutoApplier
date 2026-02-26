import { SettingsSkeleton } from "@/components/shared/Skeletons";
import { Cog } from "lucide-react";

export default function SettingsLoading() {
  return (
    <div className="space-y-5">
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
      <SettingsSkeleton />
    </div>
  );
}
