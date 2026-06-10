"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Upload, User, Target, ArrowRight, TrendingUp, Lightbulb } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ResumeList } from "@/components/resumes/ResumeList";
import { MyProfileTab } from "@/components/resumes/MyProfileTab";
import { resumeClient } from "@/lib/resume/client";
import type { ResumeProfile } from "@/lib/resume/types";

interface ResumesPageShellProps {
  uploadedResumes: Awaited<ReturnType<typeof import("@/app/actions/resume").getResumesWithStats>>;
}

export function ResumesPageShell({ uploadedResumes }: ResumesPageShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<ResumeProfile | null | undefined>(undefined);
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

  // Deep-link support: /resumes?tab=uploads lands on Uploads.
  // After the source/workshop split, /resumes only owns Profile + Uploads.
  // Legacy ?tab=history or ?tab=variants links redirect to /resumes/tailor.
  const VALID_TABS = ["profile", "uploads"] as const;
  type TabKey = (typeof VALID_TABS)[number];
  const queryTab = searchParams.get("tab");
  // Redirect legacy variant/history deep-links to the new workshop home.
  useEffect(() => {
    if (queryTab === "history" || queryTab === "variants") {
      router.replace(`/resumes/tailor?tab=${queryTab}`);
    }
  }, [queryTab, router]);
  const initialTab: TabKey =
    queryTab && (VALID_TABS as readonly string[]).includes(queryTab)
      ? (queryTab as TabKey)
      : hasProfile
        ? "profile"
        : "uploads";

  if (!mounted) {
    return (
      <div className="w-full">
        <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  // Tailor CTA destination — if user has no source content at all, push
  // them to /resumes/setup first. Otherwise the dedicated workshop.
  const canTailor = hasProfile || uploadedResumes.length > 0;
  const tailorHref = canTailor ? "/resumes/tailor" : "/resumes/setup";

  return (
    <>
      {/* Workshop CTA — the source/workshop split means /resumes/tailor is
          now the home of every "make me a resume from this JD" flow plus
          all past generations (History + Variants tabs live there now).
          This banner makes the destination unmistakable and replaces the
          old "Generate resume" modal that opened in-page (confused users
          because the result iframe had nowhere obvious to live). */}
      <Link
        href={tailorHref}
        className="group block rounded-xl border-2 border-emerald-300/60 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-emerald-950/20 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700 transition-all"
      >
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-600/20 shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
              Tailor a resume for a specific JD
            </p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5 leading-snug">
              {canTailor
                ? "Paste a JD, pick a template, get an ATS-matched PDF. All generations are saved — view, star, or re-download any time."
                : "Set up your profile first — we'll then walk you through generating your first tailored resume."}
            </p>
          </div>
          <ArrowRight
            size={18}
            className="text-emerald-600 dark:text-emerald-400 shrink-0 transition-transform group-hover:translate-x-0.5 hidden sm:block"
          />
        </div>
      </Link>

      <Tabs defaultValue={initialTab} className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Only source-material tabs live here now. Variants + History
              moved to /resumes/tailor where the JD-driven workflow lives. */}
          <TabsList className="self-start">
            <TabsTrigger value="profile" className="gap-1.5">
              <User size={14} />
              <span className="hidden xs:inline sm:inline">My </span>Profile
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-1.5">
              <Upload size={14} />
              Uploads
              <span className="ml-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0 text-[10px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                {uploadedResumes.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <Lightbulb size={14} />
                  Insights
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/resumes/outcomes" className="flex items-center gap-2 cursor-pointer">
                    <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">What&apos;s working</span>
                      <span className="text-[10px] text-zinc-500">Callback rate by template</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/resumes/gaps" className="flex items-center gap-2 cursor-pointer">
                    <Target size={14} className="text-amber-600 dark:text-amber-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">Keyword gaps</span>
                      <span className="text-[10px] text-zinc-500">What&apos;s blocking the most jobs</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value="profile" className="mt-5">
          <MyProfileTab
            initialProfile={profile}
            onProfileChange={setProfile}
            uploadedResumes={uploadedResumes}
          />
        </TabsContent>

        <TabsContent value="uploads" className="mt-5">
          <div className="mb-3 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200">
            <strong className="font-semibold">Your uploads are tailor-ready.</strong>{" "}
            Head to{" "}
            <Link href="/resumes/tailor" className="underline underline-offset-2 font-semibold">
              Tailor a resume
            </Link>{" "}
            — paste a JD and we&apos;ll AI-extract from your best upload on the fly.
            For faster repeat tailoring, build a structured profile under{" "}
            <Link href="/resumes/setup" className="underline underline-offset-2 font-semibold">
              Setup
            </Link>
            .
          </div>
          <ResumeList resumes={uploadedResumes} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// JdQuickStart removed — the always-visible JD textarea on /resumes pushed
// users into the tailor flow but then the result preview had nowhere
// obvious to live on that page (it would have shown above the tabs in a
// weird half-state). After the source/workshop split, /resumes/tailor IS
// the dedicated JD-paste-and-preview space, so the top of /resumes is
// now a single emerald CTA that takes the user straight there.
