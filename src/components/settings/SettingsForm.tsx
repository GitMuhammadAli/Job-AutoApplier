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
} from "@/constants/categories";
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
  };
}

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

  // Application Automation
  const [applicationEmail, setApplicationEmail] = useState(s.applicationEmail || "");
  const [applicationMode, setApplicationMode] = useState(s.applicationMode || "SEMI_AUTO");
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(s.autoApplyEnabled ?? false);
  const [maxAutoApply, setMaxAutoApply] = useState(s.maxAutoApplyPerDay?.toString() || "10");
  const [minMatchScore, setMinMatchScore] = useState(s.minMatchScoreForAutoApply?.toString() || "75");
  const [defaultSignature, setDefaultSignature] = useState(s.defaultSignature || "");

  // AI Customization
  const [customPrompt, setCustomPrompt] = useState(s.customSystemPrompt || "");
  const [tone, setTone] = useState(s.preferredTone || "professional");
  const [emailLang, setEmailLang] = useState(s.emailLanguage || "English");
  const [includeLinkedin, setIncludeLinkedin] = useState(s.includeLinkedin ?? true);
  const [includeGithub, setIncludeGithub] = useState(s.includeGithub ?? true);
  const [includePortfolio, setIncludePortfolio] = useState(s.includePortfolio ?? true);
  const [customClosing, setCustomClosing] = useState(s.customClosing || "");

  // Speed & Instant Apply
  const [instantApplyEnabled, setInstantApplyEnabled] = useState(s.instantApplyEnabled ?? false);
  const [priorityPlatforms, setPriorityPlatforms] = useState<string[]>(s.priorityPlatforms || ["rozee"]);
  const [peakHoursOnly, setPeakHoursOnly] = useState(s.peakHoursOnly ?? false);
  const [timezone, setTimezone] = useState(s.timezone || "Asia/Karachi");
  const [emailProvider, setEmailProvider] = useState(s.emailProvider || "brevo");
  const [smtpHost, setSmtpHost] = useState(s.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(s.smtpPort?.toString() || "");
  const [smtpUser, setSmtpUser] = useState(s.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(s.smtpPass || "");
  const [resumeMatchMode, setResumeMatchMode] = useState(s.resumeMatchMode || "smart");
  const [accountStatus, setAccountStatus] = useState(s.accountStatus || "active");
  const [notificationFrequency, setNotificationFrequency] = useState(s.notificationFrequency || "hourly");
  const [instantApplyDelay, setInstantApplyDelay] = useState((s.instantApplyDelay ?? 5).toString());
  const [testingEmail, setTestingEmail] = useState(false);

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
        applicationMode,
        autoApplyEnabled,
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
        instantApplyEnabled,
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
      <div className={`rounded-xl p-4 shadow-sm ring-1 ${accountStatus === "active" ? "bg-emerald-50 ring-emerald-200" : accountStatus === "paused" ? "bg-amber-50 ring-amber-200" : "bg-slate-100 ring-slate-200"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-800">
              Automation: {accountStatus === "active" ? "Active" : accountStatus === "paused" ? "Paused" : "Off"}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
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
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Muhammad Ali" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" />
          </Field>
          <Field label="LinkedIn URL">
            <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="GitHub URL">
            <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
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
        <p className="text-xs text-slate-400 mb-3">Select the categories you want. Jobs outside these categories get lower match scores.</p>
        <div className="flex flex-wrap gap-1.5">
          {JOB_CATEGORIES.map((cat) => (
            <ChipToggle key={cat} label={cat} active={categories.includes(cat)} onClick={() => toggleArray(categories, cat, setCategories)} />
          ))}
        </div>
      </Section>

      {/* ── Platforms ── */}
      <Section icon={<Radio className="h-4 w-4" />} title="Job Platforms">
        <p className="text-xs text-slate-400 mb-3">Select which sources to scrape jobs from.</p>
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

      {/* ── Notifications ── */}
      <Section icon={<Bell className="h-4 w-4" />} title="Notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Email Notifications</Label>
              <p className="text-xs text-slate-400">Get notified about new job matches</p>
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

      {/* ── Email Provider ── */}
      <Section icon={<Mail className="h-4 w-4" />} title="Email Provider">
        <div className="space-y-4">
          <Field label="Provider">
            <Select value={emailProvider} onValueChange={setEmailProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brevo">Brevo (API)</SelectItem>
                <SelectItem value="gmail">Gmail (SMTP)</SelectItem>
                <SelectItem value="outlook">Outlook (SMTP)</SelectItem>
                <SelectItem value="custom">Custom SMTP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(emailProvider === "gmail" || emailProvider === "outlook" || emailProvider === "custom") && (
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
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
              <Field label="SMTP User">
                <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your@email.com" />
              </Field>
              <Field label="SMTP Password">
                <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" />
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

      {/* ── Application Automation ── */}
      <Section icon={<Send className="h-4 w-4" />} title="Application Automation">
        <div className="space-y-4">
          <Field label="Application Email (email to send applications FROM)">
            <Input value={applicationEmail} onChange={(e) => setApplicationEmail(e.target.value)} placeholder="yourname@gmail.com" />
          </Field>

          <Field label="Application Mode">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setApplicationMode("SEMI_AUTO")}
                className={`flex-1 rounded-lg border p-3 text-left transition-all ${applicationMode === "SEMI_AUTO" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="text-sm font-medium">Semi-Auto</div>
                <div className="text-xs text-slate-500 mt-0.5">AI prepares drafts, you review and send</div>
              </button>
              <button
                type="button"
                onClick={() => setApplicationMode("FULL_AUTO")}
                className={`flex-1 rounded-lg border p-3 text-left transition-all ${applicationMode === "FULL_AUTO" ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="text-sm font-medium">Full-Auto</div>
                <div className="text-xs text-slate-500 mt-0.5">AI prepares + auto-sends high-match jobs</div>
              </button>
            </div>
          </Field>

          {applicationMode === "FULL_AUTO" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-Apply Enabled</Label>
                  <p className="text-xs text-slate-400">Must be ON for Full-Auto to work</p>
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
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </Field>
              </div>
            </>
          )}

          <Field label="Default Signature (appended to all application emails)">
            <Textarea
              value={defaultSignature}
              onChange={(e) => setDefaultSignature(e.target.value)}
              placeholder="Best regards,&#10;Muhammad Ali&#10;linkedin.com/in/ali"
              rows={3}
            />
          </Field>
        </div>
      </Section>

      {/* ── Speed & Instant Apply ── */}
      <Section icon={<Zap className="h-4 w-4" />} title="Speed & Instant Apply">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">⚡ Instant Apply Mode</Label>
              <p className="text-xs text-slate-400 max-w-sm">
                Fresh jobs matching your profile are applied to within 2 minutes of discovery. No review step.
              </p>
              {(!autoApplyEnabled || applicationMode !== "FULL_AUTO") && instantApplyEnabled && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Requires Full-Auto mode AND Auto-Apply to be enabled above.
                </p>
              )}
            </div>
            <Switch checked={instantApplyEnabled} onCheckedChange={setInstantApplyEnabled} />
          </div>

          {instantApplyEnabled && (
            <>
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
                <p className="text-[10px] text-slate-400 mt-1">Other sources are checked every 30 min. Paid APIs run once daily.</p>
              </Field>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Peak Hours Only</Label>
                  <p className="text-xs text-slate-400">Only auto-apply during 9 AM – 6 PM your timezone. Off-hours jobs become drafts.</p>
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
                <p className="text-[10px] text-slate-400 mt-1">
                  How long to wait before auto-sending. During this window you can edit or cancel in the Applications page.
                </p>
              </Field>
            </>
          )}
        </div>
      </Section>

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
            <p className="text-[10px] text-slate-400 mt-1">{customPrompt.length}/2000</p>
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
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100/80">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg bg-slate-100 p-1.5 text-slate-500">{icon}</div>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-slate-600 mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
        active
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
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

function TagList({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
          {item}
          <button type="button" onClick={() => onRemove(i)} className="text-blue-400 hover:text-blue-600">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
