"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkle, FileText, Upload, Clock, User } from "@phosphor-icons/react";
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

  useEffect(() => {
    resumeClient.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const hasProfile = profile != null;

  return (
    <>
      <Tabs defaultValue={hasProfile ? "profile" : "uploads"} className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="profile" className="gap-1.5">
              <User size={14} weight="regular" />
              My Profile
            </TabsTrigger>
            <TabsTrigger value="variants" className="gap-1.5">
              <Sparkle size={14} weight="regular" />
              Variants
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-1.5">
              <Upload size={14} weight="regular" />
              Uploads
              <span className="ml-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0 text-[10px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                {uploadedResumes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Clock size={14} weight="regular" />
              History
            </TabsTrigger>
          </TabsList>

          {hasProfile && (
            <Button
              onClick={() => setGenerateOpen(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            >
              <Sparkle size={16} weight="fill" />
              Generate resume
            </Button>
          )}
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
