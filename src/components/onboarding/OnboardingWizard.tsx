"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings, completeOnboarding } from "@/app/actions/settings";
import { JOB_CATEGORIES, WORK_TYPES, EXPERIENCE_LEVELS, KEYWORD_PRESETS } from "@/constants/categories";
import {
  Loader2, ChevronRight, ChevronLeft, User, Briefcase,
  Sparkles, FileUp, Rocket, Upload, CheckCircle2,
  Settings, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { ONBOARDING, SETTINGS } from "@/lib/messages";

const STEPS = [
  { title: "About You", icon: User, description: "Basic info for personalized applications" },
  { title: "Job Preferences", icon: Briefcase, description: "Skills, categories, and location" },
  { title: "Resume", icon: FileUp, description: "Upload your resume for better matching" },
  { title: "You're Ready!", icon: Rocket, description: "Let's find your first matches" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{ totalScanned: number; matched: number } | null>(null);

  // Step 0: About You
  const [fullName, setFullName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  // Step 1: What You Want
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [workTypes, setWorkTypes] = useState<string[]>([]);

  // Step 2: Categories
  const [categories, setCategories] = useState<string[]>([]);

  // Step 3: Resume
  const [uploading, setUploading] = useState(false);
  const [uploadedResume, setUploadedResume] = useState<{ name: string; skills: string[] } | null>(null);

  // Validation
  const [stepError, setStepError] = useState<string | null>(null);

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0:
        if (!fullName.trim()) return "Full name is required.";
        return null;
      case 1:
        if (keywords.length === 0) return "Add at least one keyword.";
        if (categories.length === 0) return "Select at least one category.";
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep(step + 1);
  };

  const addKeyword = useCallback(() => {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
      setStepError(null);
    }
    setKeywordInput("");
  }, [keywordInput, keywords]);

  const toggleArr = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
    if (stepError) setStepError(null);
  };

  const handleResumeUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      formData.append("isDefault", "true");
      if (categories.length > 0) {
        formData.append("targetCategories", JSON.stringify(categories));
      }
      const res = await fetch("/api/resumes/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadedResume({
          name: data.resume.name,
          skills: data.resume.detectedSkills || [],
        });
        toast.success(ONBOARDING.RESUME_UPLOADED(data.resume.detectedSkills?.length || 0));
      } else {
        toast.error(data.error || ONBOARDING.UPLOAD_FAILED);
      }
    } catch {
      toast.error(ONBOARDING.UPLOAD_FAILED);
    }
    setUploading(false);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const settingsResult = await saveSettings({
        fullName,
        linkedinUrl,
        githubUrl,
        keywords,
        city,
        country,
        experienceLevel,
        workType: workTypes.length > 0 ? workTypes : undefined,
        preferredCategories: categories,
        emailNotifications: true,
        preferredPlatforms: ["jsearch", "indeed", "remotive", "linkedin", "arbeitnow", "arbeitnow", "rozee", "adzuna", "google"],
        preferredTone: "professional",
        emailLanguage: "English",
        applicationMode: "MANUAL",
        maxAutoApplyPerDay: 20,
        maxSendsPerHour: 8,
        sendDelaySeconds: 120,
        minMatchScoreForAutoApply: 70,
        includeLinkedin: true,
        includeGithub: true,
        includePortfolio: true,
      });
      if (!settingsResult.success) {
        toast.error(settingsResult.error || SETTINGS.FAILED_SAVE);
        setSaving(false);
        return;
      }
      await completeOnboarding();

      // Trigger instant match
      setMatching(true);
      try {
        const matchRes = await fetch("/api/onboarding/complete", { method: "POST" });
        if (matchRes.ok) {
          const result = await matchRes.json();
          setMatchResult(result);
        }
      } catch {
        // Non-critical — jobs will appear on next scrape
      }
      setMatching(false);

      toast.success(ONBOARDING.PROFILE_CONFIGURED);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(ONBOARDING.FAILED_SAVE);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5 mb-8 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                i === step ? "bg-blue-600 text-white shadow-lg scale-110" :
                i < step ? "bg-emerald-500 text-white" :
                "bg-slate-100 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-5 rounded ${i < step ? "bg-emerald-400" : "bg-slate-200 dark:bg-zinc-700"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-lg ring-1 ring-slate-100 dark:ring-zinc-700">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-blue-600" />; })()}
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{STEPS[step].title}</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{STEPS[step].description}</p>
          </div>

          {/* Step 0: About You */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ob-fullname" className="text-xs font-medium text-slate-600 dark:text-zinc-300">Full Name</Label>
                <Input id="ob-fullname" value={fullName} onChange={(e) => { setFullName(e.target.value); if (stepError) setStepError(null); }} placeholder="Muhammad Ali" autoComplete="name" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-linkedin" className="text-xs font-medium text-slate-600 dark:text-zinc-300">LinkedIn URL (optional)</Label>
                <Input id="ob-linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" autoComplete="url" spellCheck={false} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-github" className="text-xs font-medium text-slate-600 dark:text-zinc-300">GitHub URL (optional)</Label>
                <Input id="ob-github" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/…" autoComplete="url" spellCheck={false} className="mt-1" />
              </div>
            </div>
          )}

          {/* Step 1: Job Preferences (keywords + categories + location) */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ob-keywords" className="text-xs font-medium text-slate-600 dark:text-zinc-300">Skills or Job Titles (type + Enter to add, or pick below)</Label>
                <Input
                  id="ob-keywords"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="e.g. React, content writer, marketing, bidders…"
                  autoComplete="off"
                  className="mt-1"
                />
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {keywords.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/40">
                        {kw}
                        <button onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))} aria-label={`Remove ${kw}`} className="text-blue-400 hover:text-blue-600 ml-0.5 touch-manipulation">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Keyword Presets */}
              <div>
                <Label className="text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1.5 block">Quick Add — Skill Groups</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-zinc-700 p-2 scrollbar-thin">
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
                            {someSelected && !allSelected && <span className="text-[8px] text-blue-600 dark:text-blue-400 font-bold">–</span>}
                          </button>
                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 flex-1">{preset.group}</span>
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
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  {keywords.length} keyword{keywords.length !== 1 ? "s" : ""} selected
                </p>
              </div>

              {/* Categories inline */}
              <div>
                <Label className="text-xs font-medium text-slate-600 dark:text-zinc-300">Job Categories</Label>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mb-1.5">Select categories that match your skills</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {JOB_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleArr(categories, cat, setCategories)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors touch-manipulation ${
                        categories.includes(cat) ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">{categories.length} selected</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ob-city" className="text-xs font-medium text-slate-600 dark:text-zinc-300">City</Label>
                  <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" autoComplete="address-level2" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ob-country" className="text-xs font-medium text-slate-600 dark:text-zinc-300">Country</Label>
                  <Input id="ob-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pakistan" autoComplete="country-name" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 dark:text-zinc-300">Experience Level</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {EXPERIENCE_LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setExperienceLevel(experienceLevel === l.value ? "" : l.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation ${
                        experienceLevel === l.value ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Resume Upload */}
          {step === 2 && (
            <div className="space-y-4">
              {uploadedResume ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 ring-1 ring-emerald-200 dark:ring-emerald-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{uploadedResume.name}</p>
                  </div>
                  {uploadedResume.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {uploadedResume.skills.slice(0, 12).map((s) => (
                        <span key={s} className="rounded bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{s}</span>
                      ))}
                      {uploadedResume.skills.length > 12 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">+{uploadedResume.skills.length - 12} more</span>
                      )}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs"
                    onClick={() => setUploadedResume(null)}
                  >
                    Upload Different Resume
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-blue-400 p-8 cursor-pointer transition-colors">
                  <Upload className="h-8 w-8 text-slate-300 dark:text-zinc-500" />
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Drop your resume here or click to browse</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">PDF, DOCX, or TXT (max 5 MB)</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleResumeUpload(f);
                    }}
                  />
                  {uploading && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Reading your resume…
                    </p>
                  )}
                </label>
              )}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 ring-1 ring-blue-100 dark:ring-blue-800/40">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium text-center">
                  Upload your resume so we can find better jobs for you — we&apos;ll read your skills automatically.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div className="text-center py-4">
              {matching ? (
                <div className="space-y-4">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">Matching you against recent jobs…</p>
                  <div className="w-full bg-slate-100 dark:bg-zinc-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                </div>
              ) : matchResult ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-50 dark:from-emerald-950/40 to-blue-50 dark:to-blue-950/40 p-5 inline-block ring-1 ring-emerald-100/50">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                    Found {matchResult.matched} jobs for you!
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    We searched {matchResult.totalScanned} recent jobs and found {matchResult.matched} that fit your profile.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-violet-50 dark:to-violet-950/40 p-5 mb-4 inline-block ring-1 ring-blue-100/50">
                    <Sparkles className="h-10 w-10 text-blue-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">You&apos;re all set!</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">
                    We&apos;ll search 8 job sites for you automatically and find jobs that match your skills.
                  </p>
                </>
              )}
              <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-3 mt-4 text-left text-xs text-slate-600 dark:text-zinc-300 space-y-1">
                {fullName && <p><strong>Name:</strong> {fullName}</p>}
                {keywords.length > 0 && <p><strong>Keywords:</strong> {keywords.join(", ")}</p>}
                {city && <p><strong>Location:</strong> {city}{country ? `, ${country}` : ""}</p>}
                {categories.length > 0 && <p><strong>Categories:</strong> {categories.length} selected</p>}
                {uploadedResume && <p><strong>Resume:</strong> {uploadedResume.name} ({uploadedResume.skills.length} skills)</p>}
                {experienceLevel && <p><strong>Experience:</strong> {experienceLevel}</p>}
              </div>

              {/* Advanced settings prompt */}
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Want more control?</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  For advanced options like email account setup, salary filters, job sources, and notifications, visit{" "}
                  <Link href="/settings" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Settings
                  </Link>{" "}
                  after setup.
                </p>
              </div>
            </div>
          )}

          {/* Validation error */}
          {stepError && (
            <p className="mt-4 text-xs text-red-600 dark:text-red-400 text-center font-medium">{stepError}</p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStepError(null); setStep(Math.max(0, step - 1)); }}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={goNext}>
                {step === 2 && !uploadedResume ? "Skip" : "Next"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleFinish} disabled={saving || matching} className="bg-blue-600 hover:bg-blue-700">
                {(saving || matching) ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Rocket className="h-4 w-4 mr-1.5" />}
                Start Finding Jobs
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
