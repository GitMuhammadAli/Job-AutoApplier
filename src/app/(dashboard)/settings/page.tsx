import { getSettings } from "@/app/actions/settings";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { Settings, Cog } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 shadow-md shadow-slate-600/20">
            <Cog className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        </div>
        <p className="text-sm text-slate-500">
          Configure automation behavior, search preferences, and notifications.
        </p>
      </div>
      <SettingsForm settings={settings as any} />
    </div>
  );
}
