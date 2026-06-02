"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, FileText, Upload, Clock, User, Target, ArrowRight, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ResumeList } from "@/components/resumes/ResumeList";
import { MyProfileTab } from "@/components/resumes/MyProfileTab";
import { VariantsTab } from "@/components/resumes/VariantsTab";
import { HistoryTab } from "@/components/resumes/HistoryTab";
import { GenerateModal } from "@/components/resumes/GenerateModal";
import { resumeClient } from "@/lib/resume/client";
import type { ResumeProfile } from "@/lib/resume/types";

interface ResumesPageShellProps {
  uploadedResumes: Awaited<ReturnType<typeof import("@/app/actions/resume").getResumesWithStats>>;
}

export function ResumesPageShell({ uploadedResumes }: ResumesPageShellProps) {
  const [profile, setProfile] = useState<ResumeProfile | null | undefined>(undefined);
  const [generateOpen, setGenerateOpen] = useState(false);
  // Defer the tabs rendering until after mount. Radix Tabs Provider's SSR
  // output doesn't match the first client render's DOM tree (known issue —
  // <div> in <div> mismatch). Hydrating after mount avoids the warning and
  // the "Switched to client rendering" cascade.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    resumeClient.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const hasProfile = profile != null;

  if (!mounted) {
    return (
      <div className="w-full">
        <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <>
      {/* JD quick-start — full-page tailoring flow (the new one). Lives above
          tabs so it's the first thing users see — pasted a JD from Indeed,
          they get straight to a tailored PDF with keyword coverage. */}
      {hasProfile && <JdQuickStart />}
      <Tabs defaultValue={hasProfile ? "profile" : "uploads"} className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="profile" className="gap-1.5">
              <User size={14} />
              My Profile
            </TabsTrigger>
            <TabsTrigger value="variants" className="gap-1.5">
              <Sparkles size={14} />
              Variants
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-1.5">
              <Upload size={14} />
              Uploads
              <span className="ml-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0 text-[10px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                {uploadedResumes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Clock size={14} />
              History
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {hasProfile && (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="gap-1.5"
                  title="Callback rate by template + coverage across your sent applications"
                >
                  <Link href="/resumes/outcomes">
                    <TrendingUp size={14} />
                    What&apos;s working
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="gap-1.5"
                  title="See the keywords blocking the most jobs in your shortlist"
                >
                  <Link href="/resumes/gaps">
                    <Target size={14} />
                    Gaps
                  </Link>
                </Button>
              </>
            )}
            {hasProfile ? (
              <Button
                onClick={() => setGenerateOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                <Sparkles size={16} />
                Generate resume
              </Button>
            ) : (
              // Users with only legacy PDF uploads (no structured profile yet) need
              // to set one up before generating. Don't hide the entry point — link
              // them straight to the setup flow so they can discover the feature.
              <Button
                asChild
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                <Link href="/resumes/setup">
                  <Sparkles size={16} />
                  Generate resume
                </Link>
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="profile" className="mt-5">
          <MyProfileTab
            initialProfile={profile}
            onProfileChange={setProfile}
            uploadedResumes={uploadedResumes}
          />
        </TabsContent>

        <TabsContent value="variants" className="mt-5">
          <VariantsTab />
        </TabsContent>

        <TabsContent value="uploads" className="mt-5">
          <div className="mb-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Legacy uploads.</strong>{" "}
            These PDFs work for auto-apply attachments. For ATS-tailored, JD-aware PDFs,
            build your structured profile under{" "}
            <Link href="#" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
              My Profile
            </Link>
            .
          </div>
          <ResumeList resumes={uploadedResumes} />
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <HistoryTab />
        </TabsContent>
      </Tabs>

      {hasProfile && (
        <GenerateModal
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Quick-paste JD card — surfaces the dedicated /resumes/tailor flow at the
 * top of the page. Users paste a JD here, hit Enter, and land in the
 * full-page tailoring experience with template chooser + ATS coverage panel.
 *
 * Why a card and not a button: people who copy a JD from Indeed want to
 * paste it immediately — the textarea is the affordance that matches that
 * intent. The card converts visitors into the new flow faster than a button
 * labelled "Tailor".
 */
function JdQuickStart() {
  const [jd, setJd] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jd.trim().length < 20) return;
    const encoded = encodeURIComponent(jd.trim().slice(0, 8000));
    router.push(`/resumes/tailor?jd=${encoded}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-950/20 dark:via-zinc-900 dark:to-zinc-900 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow">
          <Target size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Tailor for a specific job
          </p>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
            Paste the JD here, pick a template, get an ATS-matched PDF with
            keyword coverage so you can see exactly which terms landed.
          </p>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the job description (from Indeed, LinkedIn, anywhere)…"
            rows={3}
            className="mt-2 w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
              {jd.trim().length < 20 ? `Need ${20 - jd.trim().length} more chars` : `${jd.length} chars`}
            </p>
            <Button
              type="submit"
              disabled={jd.trim().length < 20}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Tailor for this JD <ArrowRight size={12} />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
