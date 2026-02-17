import { getSettings } from "@/app/actions/settings";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">
          Configure job tracking, search, and notification preferences
        </p>
      </div>
      <SettingsForm settings={settings as any} />
    </div>
  );
}
