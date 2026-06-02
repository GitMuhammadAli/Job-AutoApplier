"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Sparkles, Upload, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProfileEditor } from "@/components/resumes/ProfileEditor";
import { resumeClient, emptyProfile } from "@/lib/resume/client";
import type { ResumeProfile } from "@/lib/resume/types";

type Path = "upload" | "scratch" | null;
type Stage = "pick-path" | "pick-pdf" | "parsing" | "edit";

interface UploadedResume {
  id: string;
  name: string;
  fileName: string | null;
  createdAt: Date | string;
  isDefault: boolean;
  // additional fields from getResumesWithStats are tolerated
  [key: string]: unknown;
}

interface ResumeOnboardingWizardProps {
  initialPath: Path;
  uploadedResumes: UploadedResume[];
}

export function ResumeOnboardingWizard({ initialPath, uploadedResumes }: ResumeOnboardingWizardProps) {
  const router = useRouter();
  const [path, setPath] = useState<Path>(initialPath);
  const [stage, setStage] = useState<Stage>(
    initialPath === "upload" && uploadedResumes.length > 0
      ? "pick-pdf"
      : initialPath === "scratch"
        ? "edit"
        : "pick-path",
  );
  const [draft, setDraft] = useState<ResumeProfile | null>(
    initialPath === "scratch" ? emptyProfile() : null,
  );

  async function parseUploaded(resumeId: string) {
    setStage("parsing");
    try {
      const { candidate, warnings } = await resumeClient.parsePdf(resumeId);
      setDraft(candidate);
      if (warnings && warnings.length > 0) {
        toast.warning(
          `Parser flagged ${warnings.length} issue(s). Review and fix in the editor before saving.`,
        );
      } else {
        toast.success("Parsed. Review each item before saving.");
      }
      setStage("edit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
      setStage("pick-pdf");
    }
  }

  return (
    <div className="space-y-5 animate-slide-up max-w-5xl mx-auto">
      <Header
        path={path}
        stage={stage}
        onBack={() => {
          if (stage === "edit" && path === "upload") {
            setStage("pick-pdf");
            setDraft(null);
          } else if (stage === "pick-pdf" || stage === "edit") {
            setPath(null);
            setStage("pick-path");
            setDraft(null);
          } else {
            router.push("/resumes");
          }
        }}
      />

      {stage === "pick-path" && (
        <PickPathStep
          uploadedCount={uploadedResumes.length}
          defaultResumeId={
            uploadedResumes.find((r) => r.isDefault)?.id ??
            uploadedResumes[0]?.id ??
            null
          }
          defaultResumeName={
            uploadedResumes.find((r) => r.isDefault)?.name ??
            uploadedResumes[0]?.name ??
            null
          }
          onAutoExtract={(id) => {
            setPath("upload");
            parseUploaded(id);
          }}
          onPickUpload={() => {
            setPath("upload");
            setStage("pick-pdf");
          }}
          onPickScratch={() => {
            setPath("scratch");
            setDraft(emptyProfile());
            setStage("edit");
          }}
        />
      )}

      {stage === "pick-pdf" && (
        <PickPdfStep
          uploadedResumes={uploadedResumes}
          onPick={(id) => parseUploaded(id)}
        />
      )}

      {stage === "parsing" && <ParsingStep />}

      {stage === "edit" && draft && (
        <ProfileEditor
          initialProfile={draft}
          onCancel={() => router.push("/resumes")}
          onSave={() => {
            toast.success("Profile saved");
            router.push("/resumes");
          }}
          embedded
        />
      )}
    </div>
  );
}

function Header({ path, stage, onBack }: { path: Path; stage: Stage; onBack: () => void }) {
  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="gap-1.5 -ml-2 mb-3">
        <ArrowLeft size={14} /> Back
      </Button>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
          <Sparkles size={16} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Set up your structured profile
        </h1>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {stage === "pick-path" && "Three paths in. Each leads to the same editable profile."}
        {stage === "pick-pdf" && "Pick which uploaded PDF the AI should extract from."}
        {stage === "parsing" && "AI extracting candidate fields. You'll confirm every line before save."}
        {stage === "edit" && (path === "upload" ? "Review what AI extracted. Edit, save." : "Empty profile — fill in your sections.")}
      </p>
    </div>
  );
}

function PickPathStep({
  uploadedCount,
  defaultResumeId,
  defaultResumeName,
  onAutoExtract,
  onPickUpload,
  onPickScratch,
}: {
  uploadedCount: number;
  defaultResumeId: string | null;
  defaultResumeName: string | null;
  onAutoExtract: (resumeId: string) => void;
  onPickUpload: () => void;
  onPickScratch: () => void;
}) {
  const hasUploads = uploadedCount > 0 && defaultResumeId !== null;

  return (
    <div className="space-y-4">
      {/* Primary path — when the user has uploads, surface one-click
          auto-extract from their default (or most-recent) PDF. Most users
          will just want this; setting them up to click through pick-pdf
          → confirm is friction. They can still pick a different PDF below. */}
      {hasUploads && defaultResumeId && (
        <button
          onClick={() => onAutoExtract(defaultResumeId)}
          className="w-full text-left rounded-2xl border-2 border-emerald-400 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30 p-5 hover:shadow-lg transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow">
              <Sparkles size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Auto-extract from{" "}
                  <span className="italic">{defaultResumeName}</span>
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                  Fastest
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                We&apos;ll AI-extract every section (~5s), then drop you into
                the editor to confirm. You&apos;ll be done in under 2 minutes
                if your PDF is well-formatted.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 group-hover:gap-2 transition-all">
                Start auto-extract <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Zero-state hint — when user has neither uploads nor a profile,
          steer them at the fastest path: upload a PDF first, AI does the
          tedious work, then this same page hands them auto-extract on
          their next visit. Empty-state friction was the original
          /resumes/setup pain. */}
      {!hasUploads && (
        <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow">
              <Upload size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                No resume on file yet
              </p>
              <p className="text-[12px] text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                Fastest path: upload an existing PDF below, we&apos;ll
                AI-extract your structured profile in ~5s. Or fill from
                scratch — your call.
              </p>
              <Link
                href="/resumes"
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
              >
                Upload a resume first <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Secondary paths */}
      <div className="grid sm:grid-cols-2 gap-4">
        <PathCard
          icon={<Upload size={20} />}
          title={hasUploads ? "Pick a different upload" : "Upload (extract from PDF)"}
          description="AI reads your existing resume and fills the editor. You confirm every line before save. No silent edits."
          cta={uploadedCount > 0 ? `Pick from your ${uploadedCount} uploads` : "Upload a resume first"}
          disabled={uploadedCount === 0}
          onClick={onPickUpload}
        />
        <PathCard
          icon={<Pencil size={20} />}
          title="Start from scratch"
          description="Empty profile. Fill in header, summaries, skills, experience, projects, education one section at a time."
          cta="Open empty profile"
          onClick={onPickScratch}
        />
      </div>
    </div>
  );
}

function PathCard({
  icon,
  title,
  description,
  cta,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-left rounded-2xl border bg-white dark:bg-zinc-900 p-6 transition-all ${
        disabled
          ? "opacity-50 cursor-not-allowed border-zinc-200 dark:border-zinc-800"
          : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-md"
      }`}
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1.5">{title}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">{description}</p>
      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        {cta} <ArrowRight size={14} />
      </div>
    </button>
  );
}

function PickPdfStep({
  uploadedResumes,
  onPick,
}: {
  uploadedResumes: UploadedResume[];
  onPick: (id: string) => void;
}) {
  if (uploadedResumes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You don't have any uploaded resumes yet.{" "}
          <Link href="/resumes" className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2">
            Upload one first
          </Link>{" "}
          and come back.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {uploadedResumes.map((r) => (
        <li key={r.id}>
          <button
            onClick={() => onPick(r.id)}
            className="w-full text-left flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 shrink-0">
              <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {r.name}
                {r.isDefault && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded px-1.5 py-0.5">
                    Default
                  </span>
                )}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                {r.fileName ?? "no filename"} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
            <ArrowRight size={16} className="text-zinc-400 shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ParsingStep() {
  return (
    <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-12 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 mb-4 shadow-lg shadow-emerald-500/30 animate-pulse">
        <Sparkles size={22} className="text-white" />
      </div>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
        Extracting structure
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
        AI is parsing your PDF into the structured profile shape. This takes 3–6 seconds.
        Nothing is saved yet — you'll review every field on the next step.
      </p>
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 size={14} /> Verbatim bullets · no rewriting · no fabrication
      </div>
    </div>
  );
}
