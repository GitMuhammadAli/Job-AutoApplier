import { Suspense } from "react";
import { FileText } from "lucide-react";
import { ResumesPageShell } from "@/components/resumes/ResumesPageShell";
import { ResumesSkeleton } from "@/components/shared/Skeletons";
import { getResumesWithStats } from "@/app/actions/resume";

export const dynamic = "force-dynamic";

export default function ResumesPage() {
  return (
    <div className="space-y-5 animate-slide-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
              <FileText size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Resumes
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            One structured profile, many ATS-clean PDFs. We reorder and select — never rewrite.
          </p>
        </div>
      </header>

      <Suspense fallback={<ResumesSkeleton />}>
        <ResumesContent />
      </Suspense>
    </div>
  );
}

async function ResumesContent() {
  let uploadedResumes: Awaited<ReturnType<typeof getResumesWithStats>> = [];

  try {
    uploadedResumes = await getResumesWithStats();
  } catch (err) {
    console.error("[ResumesPage] Failed to load uploaded resumes:", err);
  }

  return <ResumesPageShell uploadedResumes={uploadedResumes} />;
}
