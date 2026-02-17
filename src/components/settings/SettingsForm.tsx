"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "@/app/actions/settings";
import {
  Loader2,
  Save,
  Target,
  Zap,
  Bell,
  User,
  Code,
  Search,
  MapPin,
  DollarSign,
  Briefcase,
  GraduationCap,
  Globe,
} from "lucide-react";

const EXP_LEVELS = [
  { value: "JUNIOR", label: "Junior (0-2 years)" },
  { value: "MID", label: "Mid-Level (2-5 years)" },
  { value: "SENIOR", label: "Senior (5+ years)" },
  { value: "LEAD", label: "Lead / Principal" },
  { value: "ANY", label: "Any Level" },
];

const EDU_LEVELS = [
  { value: "BACHELORS", label: "Bachelors" },
  { value: "MASTERS", label: "Masters" },
  { value: "PHD", label: "PhD" },
  { value: "ANY", label: "Any / Self-Taught" },
];

const JOB_CATEGORIES = [
  "Full-Stack",
  "Backend",
  "Frontend",
  "Mobile",
  "DevOps",
  "Data Engineering",
  "Machine Learning",
  "QA / Testing",
  "UI/UX Design",
  "Cybersecurity",
  "Cloud / Infrastructure",
  "Blockchain",
];

const WORK_TYPES = [
  { value: "", label: "Any (no preference)" },
  { value: "REMOTE", label: "Remote" },
  { value: "ONSITE", label: "On-site" },
  { value: "HYBRID", label: "Hybrid" },
];

const PLATFORMS = [
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "INDEED", label: "Indeed" },
  { value: "GLASSDOOR", label: "Glassdoor" },
  { value: "ROZEE_PK", label: "Rozee.pk" },
  { value: "REMOTIVE", label: "Remotive" },
  { value: "ARBEITNOW", label: "Arbeitnow" },
];

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "INR"];

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
  experienceLevel: string | null;
  skills: string | null;
  jobCategories: string | null;
  educationLevel: string | null;
  languages: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  salaryCurrency: string;
  preferredWorkType: string | null;
  preferredPlatforms: string | null;
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
    experienceLevel: settings.experienceLevel ?? "",
    skills: settings.skills ?? "",
    jobCategories: settings.jobCategories ?? "",
    educationLevel: settings.educationLevel ?? "",
    languages: settings.languages ?? "",
    minSalary: settings.minSalary ?? "",
    maxSalary: settings.maxSalary ?? "",
    salaryCurrency: settings.salaryCurrency ?? "PKR",
    preferredWorkType: settings.preferredWorkType ?? "",
    preferredPlatforms: settings.preferredPlatforms ?? "",
  });

  const update = (field: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const selectedCategories = form.jobCategories
    ? form.jobCategories.split(",").filter(Boolean)
    : [];

  const toggleCategory = (cat: string) => {
    const cats = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    update("jobCategories", cats.join(","));
  };

  const selectedPlatforms = form.preferredPlatforms
    ? form.preferredPlatforms.split(",").filter(Boolean)
    : [];

  const togglePlatform = (plat: string) => {
    const plats = selectedPlatforms.includes(plat)
      ? selectedPlatforms.filter((p) => p !== plat)
      : [...selectedPlatforms, plat];
    update("preferredPlatforms", plats.join(","));
  };

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
          experienceLevel: form.experienceLevel || undefined,
          skills: form.skills || undefined,
          jobCategories: form.jobCategories || undefined,
          educationLevel: form.educationLevel || undefined,
          languages: form.languages || undefined,
          minSalary: form.minSalary ? Number(form.minSalary) : null,
          maxSalary: form.maxSalary ? Number(form.maxSalary) : null,
          salaryCurrency: form.salaryCurrency,
          preferredWorkType: form.preferredWorkType || undefined,
          preferredPlatforms: form.preferredPlatforms || undefined,
        });
        toast.success("Settings saved");
      } catch {
        toast.error("Failed to save settings");
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* ── 1. Profile ── */}
      <Section icon={User} title="Profile" gradient="from-blue-500 to-cyan-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Briefcase className="h-3 w-3 text-slate-400" />
              Experience Level
            </Label>
            <Select
              value={form.experienceLevel || undefined}
              onValueChange={(v) => update("experienceLevel", v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select level..." />
              </SelectTrigger>
              <SelectContent>
                {EXP_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <GraduationCap className="h-3 w-3 text-slate-400" />
              Education Level
            </Label>
            <Select
              value={form.educationLevel || undefined}
              onValueChange={(v) => update("educationLevel", v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select education..." />
              </SelectTrigger>
              <SelectContent>
                {EDU_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-slate-400" />
              Languages
            </Label>
            <Input
              value={form.languages}
              onChange={(e) => update("languages", e.target.value)}
              placeholder="English, Urdu"
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">
              Comma-separated. Used to match job language requirements.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 2. Skills & Categories ── */}
      <Section icon={Code} title="Skills & Categories" gradient="from-violet-500 to-purple-500">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Your Skills</Label>
            <Textarea
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
              placeholder="React, Node.js, TypeScript, PostgreSQL, Docker, Next.js, NestJS, Tailwind CSS, Git, AWS..."
              rows={3}
              className="resize-none text-sm"
            />
            <p className="text-[10px] text-slate-400">
              Comma-separated. These are matched against job descriptions for scoring. Be thorough -- list everything you know.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Job Categories</Label>
            <div className="flex flex-wrap gap-1.5">
              {JOB_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                      isSelected
                        ? "bg-violet-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              Select the job categories you want. Jobs outside these categories get lower match scores.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 3. Search Configuration ── */}
      <Section icon={Search} title="Search Configuration" gradient="from-emerald-500 to-teal-500">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Search Keywords</Label>
              <Input
                value={form.searchKeywords}
                onChange={(e) => update("searchKeywords", e.target.value)}
                placeholder="MERN, NestJS, Next.js, React"
                className="h-9"
              />
              <p className="text-[10px] text-slate-400">
                Each keyword becomes a separate search query on job sources.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-slate-400" />
                City / Location
              </Label>
              <Input
                value={form.searchLocation}
                onChange={(e) => update("searchLocation", e.target.value)}
                placeholder="Lahore"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Preferred Work Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {WORK_TYPES.map((wt) => (
                <button
                  key={wt.value}
                  type="button"
                  onClick={() => update("preferredWorkType", wt.value)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                    form.preferredWorkType === wt.value
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {wt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <DollarSign className="h-3 w-3 text-slate-400" />
              Salary Range Expectation
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={form.salaryCurrency}
                onValueChange={(v) => update("salaryCurrency", v)}
              >
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={form.minSalary}
                onChange={(e) => update("minSalary", e.target.value)}
                placeholder="Min"
                className="h-9 flex-1"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="number"
                value={form.maxSalary}
                onChange={(e) => update("maxSalary", e.target.value)}
                placeholder="Max"
                className="h-9 flex-1"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Monthly salary range. Jobs with salary data outside your range get flagged.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Preferred Platforms</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              Optional. Leave empty to search all platforms.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 4. Automation ── */}
      <Section icon={Zap} title="Automation" gradient="from-amber-400 to-orange-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Daily Application Target</Label>
            <Input
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
            <Label className="text-xs">Follow-up After (days)</Label>
            <Input
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
            <Label className="text-xs">Ghost Detection (days)</Label>
            <Input
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
            <Label className="text-xs">Stale Detection (days)</Label>
            <Input
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
      </Section>

      {/* ── 5. Notifications ── */}
      <Section icon={Bell} title="Notifications" gradient="from-rose-400 to-pink-500">
        <div className="space-y-4">
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
            <Label className="text-xs">Timezone</Label>
            <Input
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              placeholder="Asia/Karachi"
              className="h-9"
            />
            <p className="text-[10px] text-slate-400">Used for cron job scheduling and email timestamps.</p>
          </div>
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end pt-1 pb-6">
        <Button onClick={handleSave} disabled={isPending} className="shadow-md px-6">
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  gradient,
  children,
}: {
  icon: React.ElementType;
  title: string;
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 space-y-4">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-3.5 w-3.5 text-slate-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
