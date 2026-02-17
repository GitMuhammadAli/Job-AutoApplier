"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateSettings } from "@/app/actions/settings";
import { Loader2, Save } from "lucide-react";

interface Settings {
  id: string;
  userId: string;
  dailyTarget: number;
  ghostDays: number;
  staleDays: number;
  followUpDays: number;
  emailNotifications: boolean;
  timezone: string;
  searchKeywords: string | null;
  searchLocation: string | null;
}

interface SettingsFormProps {
  settings: Settings;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    dailyTarget: settings.dailyTarget,
    ghostDays: settings.ghostDays,
    staleDays: settings.staleDays,
    followUpDays: settings.followUpDays,
    emailNotifications: settings.emailNotifications,
    timezone: settings.timezone,
    searchKeywords: settings.searchKeywords ?? "",
    searchLocation: settings.searchLocation ?? "",
  });

  const update = (field: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateSettings({
          dailyTarget: form.dailyTarget,
          ghostDays: form.ghostDays,
          staleDays: form.staleDays,
          followUpDays: form.followUpDays,
          emailNotifications: form.emailNotifications,
          timezone: form.timezone,
          searchKeywords: form.searchKeywords || undefined,
          searchLocation: form.searchLocation || undefined,
        });
        toast.success("Settings saved");
      } catch {
        toast.error("Failed to save settings");
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Job Tracking */}
      <Card className="p-6 rounded-xl border-0 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Job Tracking</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dailyTarget">Daily Application Target</Label>
            <Input
              id="dailyTarget"
              type="number"
              min={1}
              max={50}
              value={form.dailyTarget}
              onChange={(e) => update("dailyTarget", parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-slate-400">Applications per day goal</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="followUpDays">Follow-up After (days)</Label>
            <Input
              id="followUpDays"
              type="number"
              min={1}
              max={30}
              value={form.followUpDays}
              onChange={(e) => update("followUpDays", parseInt(e.target.value) || 5)}
            />
            <p className="text-xs text-slate-400">Days before follow-up reminder</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ghostDays">Ghost Detection (days)</Label>
            <Input
              id="ghostDays"
              type="number"
              min={1}
              max={60}
              value={form.ghostDays}
              onChange={(e) => update("ghostDays", parseInt(e.target.value) || 14)}
            />
            <p className="text-xs text-slate-400">Days before marking as ghosted</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staleDays">Stale Detection (days)</Label>
            <Input
              id="staleDays"
              type="number"
              min={1}
              max={30}
              value={form.staleDays}
              onChange={(e) => update("staleDays", parseInt(e.target.value) || 7)}
            />
            <p className="text-xs text-slate-400">Days before SAVED jobs flagged stale</p>
          </div>
        </div>
      </Card>

      {/* Job Search */}
      <Card className="p-6 rounded-xl border-0 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Job Search</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="searchKeywords">Search Keywords</Label>
            <Input
              id="searchKeywords"
              value={form.searchKeywords}
              onChange={(e) => update("searchKeywords", e.target.value)}
              placeholder="MERN,NestJS,Next.js,React,Node.js"
            />
            <p className="text-xs text-slate-400">Comma-separated keywords for job scraping</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchLocation">Location</Label>
            <Input
              id="searchLocation"
              value={form.searchLocation}
              onChange={(e) => update("searchLocation", e.target.value)}
              placeholder="Lahore"
            />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6 rounded-xl border-0 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Email Notifications</p>
            <p className="text-xs text-slate-400">
              Receive emails for new jobs, follow-ups, and weekly digest
            </p>
          </div>
          <Button
            variant={form.emailNotifications ? "default" : "outline"}
            size="sm"
            onClick={() => update("emailNotifications", !form.emailNotifications)}
          >
            {form.emailNotifications ? "Enabled" : "Disabled"}
          </Button>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            placeholder="Asia/Karachi"
          />
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
