"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/app/actions/settings";
import { Loader2, Save, Target, Search, Bell, Zap } from "lucide-react";

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
    <div className="max-w-2xl space-y-5">
      {/* Job Tracking */}
      <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 space-y-4">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
            <Target className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Job Tracking</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dailyTarget" className="text-xs">Daily Application Target</Label>
            <Input
              id="dailyTarget"
              type="number"
              min={1}
              max={50}
              value={form.dailyTarget}
              onChange={(e) => update("dailyTarget", parseInt(e.target.value) || 1)}
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Applications per day goal</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="followUpDays" className="text-xs">Follow-up After (days)</Label>
            <Input
              id="followUpDays"
              type="number"
              min={1}
              max={30}
              value={form.followUpDays}
              onChange={(e) => update("followUpDays", parseInt(e.target.value) || 5)}
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Days before follow-up reminder</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ghostDays" className="text-xs">Ghost Detection (days)</Label>
            <Input
              id="ghostDays"
              type="number"
              min={1}
              max={60}
              value={form.ghostDays}
              onChange={(e) => update("ghostDays", parseInt(e.target.value) || 14)}
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Days before marking as ghosted</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staleDays" className="text-xs">Stale Detection (days)</Label>
            <Input
              id="staleDays"
              type="number"
              min={1}
              max={30}
              value={form.staleDays}
              onChange={(e) => update("staleDays", parseInt(e.target.value) || 7)}
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Days before SAVED jobs flagged stale</p>
          </div>
        </div>
      </div>

      {/* Job Search / Automation */}
      <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 space-y-4">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
            <Zap className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Automation Search</h2>
        </div>
        <p className="text-xs text-slate-500 -mt-1">
          These keywords and location are used by the hourly job scraper across JSearch, Indeed, Remotive, and Arbeitnow.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="searchKeywords" className="text-xs">Search Keywords</Label>
            <Input
              id="searchKeywords"
              value={form.searchKeywords}
              onChange={(e) => update("searchKeywords", e.target.value)}
              placeholder="MERN,NestJS,Next.js,React,Node.js"
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Comma-separated. Each keyword becomes a separate search query.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="searchLocation" className="text-xs">Location</Label>
            <Input
              id="searchLocation"
              value={form.searchLocation}
              onChange={(e) => update("searchLocation", e.target.value)}
              placeholder="Lahore"
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Used for Indeed RSS and JSearch location filtering.</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 space-y-4">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <Bell className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Notifications</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Email Notifications</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Per-job emails with apply links, recommended resume, and match score.
            </p>
          </div>
          <Switch
            checked={form.emailNotifications}
            onCheckedChange={(checked) => update("emailNotifications", checked)}
          />
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="timezone" className="text-xs">Timezone</Label>
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            placeholder="Asia/Karachi"
            className="h-9"
          />
          <p className="text-[10px] text-slate-400">Used for scheduling cron jobs and email timestamps.</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <Button onClick={handleSave} disabled={isPending} className="shadow-md">
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
