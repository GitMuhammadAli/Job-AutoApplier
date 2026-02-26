import { Suspense } from "react";
import { getResumesWithStats } from "@/app/actions/resume";
import { ResumeList } from "@/components/resumes/ResumeList";
import { ResumesSkeleton } from "@/components/shared/Skeletons";
import { FileText, Lightbulb } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ResumesPage() {
  return (
    <div className="space-y-5 animate-slide-up">
      {/* Static header — renders instantly */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md shadow-indigo-500/20">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Resumes</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Manage CV variants. The automation auto-recommends the best resume for each job match.
          </p>
        </div>
      </div>

      {/* Async data streams in */}
      <Suspense fallback={<ResumesSkeleton />}>
        <ResumesContent />
      </Suspense>
    </div>
  );
}

async function ResumesContent() {
  let resumes: Awaited<ReturnType<typeof getResumesWithStats>> = [];

  try {
    resumes = await getResumesWithStats();
  } catch (error) {
    console.error("[ResumesPage] Failed to load resumes:", error);
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-6 text-center">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Failed to load resumes</p>
        <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/60">Please refresh the page to try again.</p>
      </div>
    );
  }

  return (
    <>
      {resumes.length < 3 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Tip: Upload resumes for different tech stacks
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/70">
              For example, a MERN stack resume, a Next.js resume, and a general full-stack resume.
              The AI picks the best-matching resume for each job automatically — more variants means better recommendations and higher match scores.
            </p>
          </div>
        </div>
      )}
      <ResumeList resumes={resumes} />
    </>
  );
}
