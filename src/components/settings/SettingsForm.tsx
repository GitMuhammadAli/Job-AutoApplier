"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSettings } from "@/app/actions/settings";
import {
  JOB_CATEGORIES,
  TONE_OPTIONS,
  LANGUAGE_OPTIONS,
  JOB_SOURCES,
  EXPERIENCE_LEVELS,
  EDUCATION_LEVELS,
  WORK_TYPES,
  JOB_TYPES,
  SALARY_CURRENCIES,
  KEYWORD_PRESETS,
} from "@/constants/categories";
import { APPLICATION_MODES, EMAIL_PROVIDERS } from "@/constants/settings";
import {
  Save,
  User,
  Briefcase,
  Grid3X3,
  Radio,
  Bell,
  Send,
  Sparkles,
  X,
  Plus,
  Loader2,
  Zap,
  Mail,
  Shield,
  Hand,
  Bot,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";

interface SettingsFormProps {
  initialSettings: {
    fullName?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    portfolioUrl?: string | null;
    githubUrl?: string | null;
    keywords?: string[];
    city?: string | null;
    country?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    experienceLevel?: string | null;
    education?: string | null;
    workType?: string[];
    jobType?: string[];
    languages?: string[];
    preferredCategories?: string[];
    preferredPlatforms?: string[];
    emailNotifications?: boolean;
    notificationEmail?: string | null;
    applicationEmail?: string | null;
    applicationMode?: string;
    autoApplyEnabled?: boolean;
    maxAutoApplyPerDay?: number;
    minMatchScoreForAutoApply?: number;
    defaultSignature?: string | null;
    customSystemPrompt?: string | null;
    preferredTone?: string | null;
    emailLanguage?: string | null;
    includeLinkedin?: boolean;
    includeGithub?: boolean;
    includePortfolio?: boolean;
    customClosing?: string | null;
    instantApplyEnabled?: boolean;
    priorityPlatforms?: string[];
    peakHoursOnly?: boolean;
    timezone?: string | null;
    emailProvider?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUser?: string | null;
    smtpPass?: string | null;
    resumeMatchMode?: string | null;
    accountStatus?: string | null;
    notificationFrequency?: string | null;
    instantApplyDelay?: number | null;
    sendDelaySeconds?: number | null;
    maxSendsPerHour?: number | null;
    maxSendsPerDay?: number | null;
    cooldownMinutes?: number | null;
    bouncePauseHours?: number | null;
    sendingPausedUntil?: string | Date | null;
  };
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  Hand: <Hand className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Bot: <Bot className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
};

const RISK_COLORS: Record<string, string> = {
  none: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  low: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  high: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
};

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const s = initialSettings;
  const [saving, setSaving] = useState(false);

  // Personal
  const [fullName, setFullName] = useState(s.fullName || "");
  const [phone, setPhone] = useState(s.phone || "");
  const [linkedinUrl, setLinkedinUrl] = useState(s.linkedinUrl || "");
  const [portfolioUrl, setPortfolioUrl] = useState(s.portfolioUrl || "");
  const [githubUrl, setGithubUrl] = useState(s.githubUrl || "");

  // Job Preferences
  const [keywords, setKeywords] = useState<string[]>(s.keywords || []);
  const [keywordInput, setKeywordInput] = useState("");
  const [city, setCity] = useState(s.city || "");
  const [country, setCountry] = useState(s.country || "");
  const [salaryMin, setSalaryMin] = useState(s.salaryMin?.toString() || "");
  const [salaryMax, setSalaryMax] = useState(s.salaryMax?.toString() || "");
  const [salaryCurrency, setSalaryCurrency] = useState(s.salaryCurrency || "USD");
  const [experienceLevel, setExperienceLevel] = useState(s.experienceLevel || "");
  const [education, setEducation] = useState(s.education || "");
  const [workType, setWorkType] = useState<string[]>(s.workType || []);
  const [jobType, setJobType] = useState<string[]>(s.jobType || []);
  const [languages, setLanguages] = useState<string[]>(s.languages || []);
  const [langInput, setLangInput] = useState("");

  // Categories & Platforms
  const [categories, setCategories] = useState<string[]>(s.preferredCategories || []);
  const [platforms, setPlatforms] = useState<string[]>(s.preferredPlatforms || []);

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(s.emailNotifications ?? true);
  const [notificationEmail, setNotificationEmail] = useState(s.notificationEmail || "");

  // Email Provider
  const [emailProvider, setEmailProvider] = useState(s.emailProvider || "brevo");
  const [smtpHost, setSmtpHost] = useState(s.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(s.smtpPort?.toString() || "");
  const [smtpUser, setSmtpUser] = useState(s.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(s.smtpPass || "");
  const [testingEmail, setTestingEmail] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  // Application Automation
  const [applicationEmail, setApplicationEmail] = useState(s.applicationEmail || "");
  const [applicationMode, setApplicationMode] = useState(
    s.instantApplyEnabled
      ? "instant"
      : s.applicationMode === "FULL_AUTO"
        ? "full_auto"
        : s.applicationMode === "MANUAL"
          ? "manual"
          : "semi_auto"
  );
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(s.autoApplyEnabled ?? false);
  const [maxAutoApply, setMaxAutoApply] = useState(s.maxAutoApplyPerDay?.toString() || "10");
  const [minMatchScore, setMinMatchScore] = useState(s.minMatchScoreForAutoApply?.toString() || "75");
  const [defaultSignature, setDefaultSignature] = useState(s.defaultSignature || "");

  // Sending Safety
  const [sendDelaySeconds, setSendDelaySeconds] = useState(s.sendDelaySeconds ?? 120);
  const [maxSendsPerHour, setMaxSendsPerHour] = useState(s.maxSendsPerHour ?? 8);
  const [maxSendsPerDay, setMaxSendsPerDay] = useState(s.maxSendsPerDay ?? 20);
  const [cooldownMinutes, setCooldownMinutes] = useState(s.cooldownMinutes ?? 30);
  const [bouncePauseHours, setBouncePauseHours] = useState(s.bouncePauseHours ?? 24);

  // Speed & Instant Apply
  const [instantApplyEnabled, setInstantApplyEnabled] = useState(s.instantApplyEnabled ?? false);
  const [priorityPlatforms, setPriorityPlatforms] = useState<string[]>(s.priorityPlatforms || ["rozee"]);
  const [peakHoursOnly, setPeakHoursOnly] = useState(s.peakHoursOnly ?? false);
  const [timezone, setTimezone] = useState(s.timezone || "Asia/Karachi");
  const [instantApplyDelay, setInstantApplyDelay] = useState((s.instantApplyDelay ?? 5).toString());

  // AI Customization
  const [customPrompt, setCustomPrompt] = useState(s.customSystemPrompt || "");
  const [tone, setTone] = useState(s.preferredTone || "professional");
  const [emailLang, setEmailLang] = useState(s.emailLanguage || "English");
  const [includeLinkedin, setIncludeLinkedin] = useState(s.includeLinkedin ?? true);
  const [includeGithub, setIncludeGithub] = useState(s.includeGithub ?? true);
  const [includePortfolio, setIncludePortfolio] = useState(s.includePortfolio ?? true);
  const [customClosing, setCustomClosing] = useState(s.customClosing || "");

  // Other
  const [resumeMatchMode, setResumeMatchMode] = useState(s.resumeMatchMode || "smart");
  const [accountStatus, setAccountStatus] = useState(s.accountStatus || "active");
  const [notificationFrequency, setNotificationFrequency] = useState(s.notificationFrequency || "hourly");

  const addKeyword = useCallback(() => {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
    }
    setKeywordInput("");
  }, [keywordInput, keywords]);

  const addLanguage = useCallback(() => {
    const val = langInput.trim();
    if (val && !languages.includes(val)) {
      setLanguages([...languages, val]);
    }
    setLangInput("");
  }, [langInput, languages]);

  const toggleArray = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const resolvedSchemaMode =
    APPLICATION_MODES.find((m) => m.value === applicationMode)?.schemaValue || "SEMI_AUTO";

  const readinessChecks = [
    { key: "emailProvider", label: "Email provider set up", met: emailProvider !== "brevo" },
    { key: "resume", label: "Resume uploaded", met: true },
    { key: "fullName", label: "Full name added", met: !!fullName },
    { key: "keywords", label: "Keywords defined", met: keywords.length > 0 },
    { key: "categories", label: "Job categories selected", met: categories.length > 0 },
    { key: "nonBrevoEmail", label: "Non-Brevo email provider", met: emailProvider !== "brevo" },
  ];

  const selectedMode = APPLICATION_MODES.find((m) => m.value === applicationMode);
  const modeRequirements: readonly string[] = selectedMode?.requires ?? [];
  const unmet = readinessChecks.filter(
    (c) => modeRequirements.includes(c.key) && !c.met
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        fullName,
        phone,
        linkedinUrl,
        portfolioUrl,
        githubUrl,
        keywords,
        city,
        country,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        salaryCurrency,
        experienceLevel,
        education,
        workType,
        jobType,
        languages,
        preferredCategories: categories,
        preferredPlatforms: platforms,
        emailNotifications,
        notificationEmail,
        applicationEmail,
        applicationMode: resolvedSchemaMode,
        autoApplyEnabled: applicationMode === "full_auto" || applicationMode === "instant" ? autoApplyEnabled : false,
        maxAutoApplyPerDay: parseInt(maxAutoApply) || 10,
        minMatchScoreForAutoApply: parseInt(minMatchScore) || 75,
        defaultSignature,
        customSystemPrompt: customPrompt,
        preferredTone: tone,
        emailLanguage: emailLang,
        includeLinkedin,
        includeGithub,
        includePortfolio,
        customClosing,
        instantApplyEnabled: applicationMode === "instant",
        priorityPlatforms,
        peakHoursOnly,
        timezone,
        emailProvider,
        smtpHost,
        smtpPort: smtpPort ? parseInt(smtpPort) : null,
        smtpUser,
        smtpPass,
        resumeMatchMode,
        accountStatus,
        notificationFrequency,
        instantApplyDelay: parseInt(instantApplyDelay) || 5,
        sendDelaySeconds,
        maxSendsPerHour,
        maxSendsPerDay,
        cooldownMinutes,
        bouncePauseHours,
      });
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Account Status ── */}
      <div className={`rounded-xl p-4 shadow-sm ring-1 ${accountStatus === "active" ? "bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-800/40" : accountStatus === "paused" ? "bg-amber-50 dark:bg-amber-900/30 ring-amber-200 dark:ring-amber-800/40" : "bg-slate-100 dark:bg-zinc-800 ring-slate-200 dark:ring-zinc-700"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Automation: {accountStatus === "active" ? "Active" : accountStatus === "paused" ? "Paused" : "Off"}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {accountStatus === "active" ? "Scraping, matching, and auto-apply running normally." : accountStatus === "paused" ? "Jobs still scraped & matched, but no auto-apply or notifications." : "All automation stopped. Data preserved."}
            </p>
          </div>
          <Select value={accountStatus} onValueChange={setAccountStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Personal Info ── */}
      <Section icon={<User className="h-4 w-4" />} title="Personal Info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Muhammad Ali" autoComplete="name" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" autoComplete="tel" type="tel" />
          </Field>
          <Field label="LinkedIn URL">
            <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/&hellip;" autoComplete="url" spellCheck={false} />
          </Field>
          <Field label="GitHub URL">
            <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/&hellip;" autoComplete="url" spellCheck={false} />
          </Field>
          <Field label="Portfolio URL" className="sm:col-span-2">
            <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://yoursite.com" />
          </Field>
        </div>
      </Section>

      {/* ── Job Preferences ── */}
      <Section icon={<Briefcase className="h-4 w-4" />} title="Job Preferences">
        <div className="space-y-4">
          <Field label="Keywords (type + Enter to add)">
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="React, Next.js, Node.js..."
                className="flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={addKeyword}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <TagList items={keywords} onRemove={(i) => setKeywords(keywords.filter((_, idx) => idx !== i))} />
          </Field>

          {/* Keyword Presets */}
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">Quick Add — Skill Groups</Label>
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-zinc-700 p-2 scrollbar-thin">
              {KEYWORD_PRESETS.map((preset) => {
                const allSelected = preset.keywords.every((kw) => keywords.includes(kw));
                const someSelected = preset.keywords.some((kw) => keywords.includes(kw));
                return (
                  <details key={preset.group} className="group rounded-lg">
                    <summary className="flex items-center gap-2 cursor-pointer select-none rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors list-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (allSelected) {
                            setKeywords(keywords.filter((kw) => !preset.keywords.includes(kw)));
                          } else {
                            const merged = Array.from(new Set([...keywords, ...preset.keywords]));
                            setKeywords(merged);
                          }
                        }}
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                          allSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : someSelected
                              ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400"
                              : "border-slate-300 dark:border-zinc-600"
                        }`}
                      >
                        {allSelected && <span className="text-[9px] font-bold">✓</span>}
                        {someSelected && !allSelected && <span className="text-[8px] text-blue-600 font-bold">–</span>}
                      </button>
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex-1">{preset.group}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">{preset.keywords.filter((kw) => keywords.includes(kw)).length}/{preset.keywords.length}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400 dark:text-zinc-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
                      {preset.keywords.map((kw) => {
                        const selected = keywords.includes(kw);
                        return (
                          <button
                            key={kw}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setKeywords(keywords.filter((k) => k !== kw));
                              } else {
                                setKeywords([...keywords, kw]);
                              }
                            }}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors touch-manipulation ${
                              selected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600"
                            }`}
                          >
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">{keywords.length} keyword{keywords.length !== 1 ? "s" : ""} selected</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" />
            </Field>
            <Field label="Country">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pakistan" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Min Salary">
              <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="30000" />
            </Field>
            <Field label="Max Salary">
              <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="80000" />
            </Field>
            <Field label="Currency">
              <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SALARY_CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Experience Level">
              <Select value={experienceLevel || undefined} onValueChange={setExperienceLevel}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Education">
              <Select value={education || undefined} onValueChange={setEducation}>
                <SelectTrigger><SelectValue placeholder="Select education" /></SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Work Type">
            <div className="flex flex-wrap gap-2">
              {WORK_TYPES.map((w) => (
                <ChipToggle key={w.value} label={w.label} active={workType.includes(w.value)} onClick={() => toggleArray(workType, w.value, setWorkType)} />
              ))}
            </div>
          </Field>

          <Field label="Job Type">
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((j) => (
                <ChipToggle key={j.value} label={j.label} active={jobType.includes(j.value)} onClick={() => toggleArray(jobType, j.value, setJobType)} />
              ))}
            </div>
          </Field>

          <Field label="Languages (type + Enter to add)">
            <div className="flex gap-2">
              <Input
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLanguage(); } }}
                placeholder="English, Urdu..."
                className="flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={addLanguage}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <ChipToggle key={lang} label={lang} active={languages.includes(lang)} onClick={() => toggleArray(languages, lang, setLanguages)} />
              ))}
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Categories ── */}
      <Section icon={<Grid3X3 className="h-4 w-4" />} title="Job Categories">
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Select the categories you want. Jobs outside these categories get lower match scores.</p>
        <div className="flex flex-wrap gap-1.5">
          {JOB_CATEGORIES.map((cat) => (
            <ChipToggle key={cat} label={cat} active={categories.includes(cat)} onClick={() => toggleArray(categories, cat, setCategories)} />
          ))}
        </div>
      </Section>

      {/* ── Platforms ── */}
      <Section icon={<Radio className="h-4 w-4" />} title="Job Platforms">
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Select which sources to scrape jobs from.</p>
        <div className="flex flex-wrap gap-2">
          {JOB_SOURCES.map((src) => (
            <ChipToggle
              key={src.value}
              label={`${src.label} (${src.limit})`}
              active={platforms.includes(src.value)}
              onClick={() => toggleArray(platforms, src.value, setPlatforms)}
            />
          ))}
        </div>
      </Section>

      {/* ── Email Provider Education Cards ── */}
      <Section icon={<Mail className="h-4 w-4" />} title="Email Provider">
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">
          How application emails are sent. Your choice affects deliverability and how HR sees your email.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EMAIL_PROVIDERS.map((provider) => {
            const isActive = emailProvider === provider.value;
            return (
              <button
                key={provider.value}
                type="button"
                onClick={() => setEmailProvider(provider.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all touch-manipulation ${
                  isActive
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/20"
                    : "border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{provider.label}</span>
                  {provider.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      provider.badgeColor === "green"
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                        : provider.badgeColor === "yellow"
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                          : "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400"
                    }`}>
                      {provider.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-2.5">{provider.description}</p>

                {/* HR sees preview */}
                <div className={`rounded-lg p-2.5 ring-1 text-[10px] ${provider.previewBg}`}>
                  <div className="font-mono text-slate-600 dark:text-zinc-400">
                    {provider.hrSees
                      .replace("{name}", fullName || "Your Name")
                      .replace("{email}", applicationEmail || smtpUser || "you@email.com")}
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-zinc-400">{provider.hrResult}</div>
                </div>

                {"warning" in provider && provider.warning && isActive && (
<p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {provider.warning}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* SMTP fields for Gmail/Outlook/Custom */}
        {(emailProvider === "gmail" || emailProvider === "outlook" || emailProvider === "custom") && (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 p-4">
            {emailProvider === "gmail" && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 ring-1 ring-blue-100 dark:ring-blue-800/40">
                <button
                  type="button"
                  onClick={() => setHelpExpanded(!helpExpanded)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 touch-manipulation w-full"
                >
                  {helpExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  How to get a Gmail App Password
                </button>
                {helpExpanded && (
                  <ol className="mt-2 space-y-1 text-[11px] text-blue-600 dark:text-blue-400 list-decimal list-inside">
                    {EMAIL_PROVIDERS.find((p) => p.value === "gmail")?.helpSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="SMTP Host">
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder={emailProvider === "gmail" ? "smtp.gmail.com" : emailProvider === "outlook" ? "smtp.office365.com" : "smtp.example.com"}
                />
              </Field>
              <Field label="SMTP Port">
                <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
              </Field>
            </div>
            <Field label="Email / Username">
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your@email.com" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="App Password">
              <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" autoComplete="off" />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testingEmail}
              onClick={async () => {
                setTestingEmail(true);
                try {
                  const res = await fetch("/api/email/test", { method: "POST" });
                  const data = await res.json();
                  if (data.success) {
                    toast.success("Test email sent! Check your inbox.");
                  } else {
                    toast.error(data.hint || data.error || "Test failed");
                  }
                } catch {
                  toast.error("Failed to send test email");
                }
                setTestingEmail(false);
              }}
            >
              {testingEmail ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />}
              Send Test Email
            </Button>
          </div>
        )}

        <div className="mt-4">
          <Field label="Resume Match Mode">
            <Select value={resumeMatchMode} onValueChange={setResumeMatchMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smart">Smart (AI-powered)</SelectItem>
                <SelectItem value="keyword">Keyword-based</SelectItem>
                <SelectItem value="exact">Exact match</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* ── Notifications ── */}
      <Section icon={<Bell className="h-4 w-4" />} title="Notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Email Notifications</Label>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Get notified about new job matches</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          {emailNotifications && (
            <>
              <Field label="Notification Email (optional, defaults to login email)">
                <Input value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="alerts@example.com" />
              </Field>
              <Field label="Notification Frequency">
                <Select value={notificationFrequency} onValueChange={setNotificationFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="hourly">Hourly (max 1/hour)</SelectItem>
                    <SelectItem value="daily">Daily digest (max 3/day)</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* ── Application Mode ── */}
      <Section icon={<Send className="h-4 w-4" />} title="Application Mode">
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">
          How much control do you want over each application?
        </p>
        <Field label="Application Email (email to send applications FROM)">
          <Input type="email" value={applicationEmail} onChange={(e) => setApplicationEmail(e.target.value)} placeholder="yourname@gmail.com" autoComplete="email" spellCheck={false} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {APPLICATION_MODES.map((mode) => {
            const isActive = applicationMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setApplicationMode(mode.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all touch-manipulation ${
                  isActive
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 ring-1 ring-violet-500/20"
                    : "border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`rounded-lg p-1.5 ${isActive ? "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400" : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400"}`}>
                    {MODE_ICONS[mode.icon]}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{mode.label}</span>
                    {mode.badge && (
                      <span className="ml-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                        {mode.badge}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{mode.shortDesc}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-2">{mode.description}</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_COLORS[mode.riskLevel]}`}>
                  {mode.riskLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* What happens steps */}
        {selectedMode && (
          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-4 ring-1 ring-slate-100 dark:ring-zinc-700">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">What happens in {selectedMode.label} mode:</h4>
            <ol className="space-y-1">
              {selectedMode.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-[9px] font-bold text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {"warning" in selectedMode && selectedMode.warning && (
              <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {selectedMode.warning}
              </p>
            )}
          </div>
        )}

        {/* Readiness Checklist */}
        {modeRequirements.length > 0 && (
          <div className="mt-4 rounded-xl bg-white dark:bg-zinc-800/50 p-4 ring-1 ring-slate-200 dark:ring-zinc-700">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              Readiness Checklist for {selectedMode?.label}
            </h4>
            <div className="space-y-1.5">
              {readinessChecks
                .filter((c) => modeRequirements.includes(c.key))
                .map((check) => (
                  <div key={check.key} className="flex items-center gap-2 text-[11px]">
                    {check.met ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-red-400" />
                    )}
                    <span className={check.met ? "text-slate-600 dark:text-zinc-400" : "text-red-600 dark:text-red-400 font-medium"}>
                      {check.label}
                    </span>
                  </div>
                ))}
            </div>
            {unmet.length > 0 && (
              <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Complete the items above to enable {selectedMode?.label} mode.
              </p>
            )}
          </div>
        )}

        {/* Full-Auto sub-settings */}
        {(applicationMode === "full_auto" || applicationMode === "instant") && (
          <div className="mt-4 space-y-4 rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto-Apply Enabled</Label>
                <p className="text-xs text-slate-400 dark:text-zinc-500">Must be ON for Full-Auto to work</p>
              </div>
              <Switch checked={autoApplyEnabled} onCheckedChange={setAutoApplyEnabled} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Max Auto-Apply Per Day">
                <Input type="number" min={1} max={50} value={maxAutoApply} onChange={(e) => setMaxAutoApply(e.target.value)} />
              </Field>
              <Field label={`Min Match Score (${minMatchScore}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={minMatchScore}
                  onChange={(e) => setMinMatchScore(e.target.value)}
                  className="w-full h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </Field>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Field label="Default Signature (appended to all application emails)">
            <Textarea
              value={defaultSignature}
              onChange={(e) => setDefaultSignature(e.target.value)}
              placeholder={"Best regards,\nMuhammad Ali\nlinkedin.com/in/ali"}
              rows={3}
            />
          </Field>
        </div>
      </Section>

      {/* ── Sending Safety ── */}
      <Section icon={<Shield className="h-4 w-4" />} title="Sending Safety">
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">
          Protects your email reputation by limiting how fast and how many emails are sent.
        </p>
        {s.sendingPausedUntil && new Date(s.sendingPausedUntil) > new Date() && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 ring-1 ring-red-200 dark:ring-red-800/40 text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Sending paused until {new Date(s.sendingPausedUntil).toLocaleString()} due to bounces.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Delay between emails (seconds)">
            <Input
              type="number"
              min={30}
              max={600}
              value={sendDelaySeconds}
              onChange={(e) => setSendDelaySeconds(parseInt(e.target.value) || 120)}
            />
          </Field>
          <Field label="Max sends per hour">
            <Input
              type="number"
              min={1}
              max={30}
              value={maxSendsPerHour}
              onChange={(e) => setMaxSendsPerHour(parseInt(e.target.value) || 8)}
            />
          </Field>
          <Field label="Max sends per day">
            <Input
              type="number"
              min={1}
              max={100}
              value={maxSendsPerDay}
              onChange={(e) => setMaxSendsPerDay(parseInt(e.target.value) || 20)}
            />
          </Field>
          <Field label="Cooldown after burst (minutes)">
            <Input
              type="number"
              min={5}
              max={120}
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 30)}
            />
          </Field>
          <Field label="Auto-pause on bounces (hours)">
            <Input
              type="number"
              min={1}
              max={72}
              value={bouncePauseHours}
              onChange={(e) => setBouncePauseHours(parseInt(e.target.value) || 24)}
            />
          </Field>
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 ring-1 ring-amber-100 dark:ring-amber-800/40">
          <p className="text-[10px] text-amber-700 dark:text-amber-300">
            <strong>How it works:</strong> If 3 emails bounce in one day, sending auto-pauses for {bouncePauseHours} hours. Hourly and daily limits prevent your email from being flagged as spam.
          </p>
        </div>
      </Section>

      {/* ── Speed & Instant Apply ── */}
      {(applicationMode === "full_auto" || applicationMode === "instant") && (
        <Section icon={<Zap className="h-4 w-4" />} title="Speed & Instant Apply">
          <div className="space-y-4">
            <Field label="Priority Platforms (checked every 15 min — free sources only)">
              <div className="flex flex-wrap gap-2">
                {FREE_PLATFORM_OPTIONS.map((src) => (
                  <ChipToggle
                    key={src.value}
                    label={src.label}
                    active={priorityPlatforms.includes(src.value)}
                    onClick={() => toggleArray(priorityPlatforms, src.value, setPriorityPlatforms)}
                  />
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Other sources are checked every 30 min. Paid APIs run once daily.</p>
            </Field>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Peak Hours Only</Label>
                <p className="text-xs text-slate-400 dark:text-zinc-500">Only auto-apply during 9 AM – 6 PM your timezone. Off-hours jobs become drafts.</p>
              </div>
              <Switch checked={peakHoursOnly} onCheckedChange={setPeakHoursOnly} />
            </div>

            <Field label="Timezone">
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={`Review Delay Before Auto-Send (${instantApplyDelay} min)`}>
              <Select value={instantApplyDelay} onValueChange={setInstantApplyDelay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 min — send immediately</SelectItem>
                  <SelectItem value="5">5 min — quick review window</SelectItem>
                  <SelectItem value="15">15 min — comfortable review</SelectItem>
                  <SelectItem value="30">30 min — full review</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                How long to wait before auto-sending. During this window you can edit or cancel in the Applications page.
              </p>
            </Field>
          </div>
        </Section>
      )}

      {/* ── AI Customization ── */}
      <Section icon={<Sparkles className="h-4 w-4" />} title="AI Customization">
        <div className="space-y-4">
          <Field label="Custom System Prompt (your own AI instructions, injected into every generation)">
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Always mention my open-source contributions. Reference my Next.js 14 experience. Keep under 200 words."
              rows={4}
              maxLength={2000}
            />
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">{customPrompt.length}/2000</p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Preferred Tone">
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — {t.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email Language">
              <Select value={emailLang} onValueChange={setEmailLang}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Include LinkedIn URL in applications</Label>
              <Switch checked={includeLinkedin} onCheckedChange={setIncludeLinkedin} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Include GitHub URL in applications</Label>
              <Switch checked={includeGithub} onCheckedChange={setIncludeGithub} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Include Portfolio URL in applications</Label>
              <Switch checked={includePortfolio} onCheckedChange={setIncludePortfolio} />
            </div>
          </div>

          <Field label="Custom Closing">
            <Input value={customClosing} onChange={(e) => setCustomClosing(e.target.value)} placeholder="Looking forward to connecting" maxLength={100} />
          </Field>
        </div>
      </Section>

      {/* ── Mode Comparison Table ── */}
      <Section icon={<Grid3X3 className="h-4 w-4" />} title="Mode Comparison">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-700">
                <th className="py-2 pr-3 text-left font-semibold text-slate-500 dark:text-zinc-400">Feature</th>
                <th className="py-2 px-3 text-center font-semibold text-slate-500 dark:text-zinc-400">Manual</th>
                <th className="py-2 px-3 text-center font-semibold text-slate-500 dark:text-zinc-400">Semi-Auto</th>
                <th className="py-2 px-3 text-center font-semibold text-slate-500 dark:text-zinc-400">Full Auto</th>
                <th className="py-2 pl-3 text-center font-semibold text-slate-500 dark:text-zinc-400">Instant</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-zinc-400">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-slate-50 dark:border-zinc-800">
                  <td className="py-1.5 pr-3 font-medium">{row.feature}</td>
                  <td className="py-1.5 px-3 text-center">{row.manual}</td>
                  <td className="py-1.5 px-3 text-center">{row.semi}</td>
                  <td className="py-1.5 px-3 text-center">{row.full}</td>
                  <td className="py-1.5 pl-3 text-center">{row.instant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Data Export ── */}
      <Section title="Data Export" icon={<Save className="h-4 w-4" />}>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
          Download all your data as a ZIP file including jobs, applications, resumes, templates, and activity logs.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const res = await fetch("/api/export");
              if (!res.ok) throw new Error();
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `jobpilot-export-${new Date().toISOString().split("T")[0]}.zip`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Export downloaded!");
            } catch {
              toast.error("Export failed. Try again.");
            }
          }}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Export All My Data
        </Button>
      </Section>

      {/* ── Save Button ── */}
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="shadow-lg px-6">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Helper Components ──

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800/80 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg bg-slate-100 dark:bg-zinc-700 p-1.5 text-slate-500 dark:text-zinc-400">{icon}</div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors touch-manipulation focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none ${
        active
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
      }`}
    >
      {label}
    </button>
  );
}

function TagList({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/40">
          {item}
          <button type="button" onClick={() => onRemove(i)} className="text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

const FREE_PLATFORM_OPTIONS = [
  { value: "indeed", label: "Indeed" },
  { value: "remotive", label: "Remotive" },
  { value: "arbeitnow", label: "Arbeitnow" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "rozee", label: "Rozee.pk" },
];

const COMMON_TIMEZONES = [
  { value: "Asia/Karachi", label: "Asia/Karachi (PKT, UTC+5)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh (AST, UTC+3)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "America/Toronto", label: "America/Toronto (EST/EDT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT)" },
];

const COMPARISON_ROWS = [
  { feature: "Scrapes jobs", manual: "✓", semi: "✓", full: "✓", instant: "✓" },
  { feature: "AI match scoring", manual: "✓", semi: "✓", full: "✓", instant: "✓" },
  { feature: "AI writes email", manual: "✓", semi: "✓", full: "✓", instant: "✓" },
  { feature: "Picks best resume", manual: "✓", semi: "✓", full: "✓", instant: "✓" },
  { feature: "You review before send", manual: "—", semi: "✓", full: "Optional", instant: "—" },
  { feature: "Sends automatically", manual: "—", semi: "—", full: "✓", instant: "✓" },
  { feature: "Speed", manual: "You decide", semi: "Minutes", full: "< 30 min", instant: "< 5 min" },
  { feature: "Risk level", manual: "Zero", semi: "Low", full: "Medium", instant: "Higher" },
  { feature: "Best for", manual: "Control", semi: "Balance", full: "Volume", instant: "Speed" },
];
