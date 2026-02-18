"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettings, completeOnboarding } from "@/app/actions/settings";
import { JOB_CATEGORIES, WORK_TYPES, EXPERIENCE_LEVELS } from "@/constants/categories";
import { Loader2, ChevronRight, ChevronLeft, User, Briefcase, Grid3X3, Sparkles } from "lucide-react";

const STEPS = [
  { title: "About You", icon: User, description: "Basic info for personalized applications" },
  { title: "What You Want", icon: Briefcase, description: "Keywords, location, and preferences" },
  { title: "Categories", icon: Grid3X3, description: "Select job categories you're interested in" },
  { title: "Ready!", icon: Sparkles, description: "You're all set to start" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [workTypes, setWorkTypes] = useState<string[]>([]);

  const [categories, setCategories] = useState<string[]>([]);

  const addKeyword = useCallback(() => {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
    }
    setKeywordInput("");
  }, [keywordInput, keywords]);

  const toggleArr = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await saveSettings({
        fullName,
        linkedinUrl,
        githubUrl,
        keywords,
        city,
        country,
        experienceLevel,
        workType: workTypes,
        preferredCategories: categories,
        emailNotifications: true,
        preferredPlatforms: ["jsearch", "indeed", "remotive", "linkedin", "arbeitnow"],
      });
      await completeOnboarding();
      toast.success("Profile configured! Jobs will start appearing soon.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Failed to save. Try again.");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i === step ? "bg-blue-600 text-white shadow-lg scale-110" :
                i < step ? "bg-emerald-500 text-white" :
                "bg-slate-100 text-slate-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 rounded ${i < step ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-100">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-blue-600" />; })()}
              <h2 className="text-lg font-bold text-slate-900">{STEPS[step].title}</h2>
            </div>
            <p className="text-sm text-slate-500">{STEPS[step].description}</p>
          </div>

          {/* Step 0: About You */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Muhammad Ali" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">LinkedIn URL (optional)</Label>
                <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">GitHub URL (optional)</Label>
                <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="mt-1" />
              </div>
            </div>
          )}

          {/* Step 1: What You Want */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">Keywords (press Enter to add)</Label>
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="React, Node.js, Python..."
                  className="mt-1"
                />
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {keywords.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                        {kw}
                        <button onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))} className="text-blue-400 hover:text-blue-600 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-600">City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pakistan" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Experience Level</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {EXPERIENCE_LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setExperienceLevel(experienceLevel === l.value ? "" : l.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        experienceLevel === l.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Work Type</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {WORK_TYPES.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => toggleArr(workTypes, w.value, setWorkTypes)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        workTypes.includes(w.value) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Categories */}
          {step === 2 && (
            <div>
              <p className="text-xs text-slate-400 mb-3">Select categories that match your skills. This helps us find the right jobs.</p>
              <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
                {JOB_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleArr(categories, cat, setCategories)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      categories.includes(cat) ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">{categories.length} selected</p>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div className="text-center py-6">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-5 mb-4 inline-block ring-1 ring-blue-100/50">
                <Sparkles className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800">You&apos;re all set!</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                JobPilot will now scrape jobs from 8 sources and match them to your profile. Add your resumes next for smarter matching.
              </p>
              <div className="bg-slate-50 rounded-lg p-3 mt-4 text-left text-xs text-slate-600 space-y-1">
                {fullName && <p><strong>Name:</strong> {fullName}</p>}
                {keywords.length > 0 && <p><strong>Keywords:</strong> {keywords.join(", ")}</p>}
                {city && <p><strong>Location:</strong> {city}{country ? `, ${country}` : ""}</p>}
                {categories.length > 0 && <p><strong>Categories:</strong> {categories.length} selected</p>}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleFinish} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Start Finding Jobs
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
