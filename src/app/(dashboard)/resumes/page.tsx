import { getResumesWithStats } from "@/app/actions/resume";
import { ResumeList } from "@/components/resumes/ResumeList";
import { FileText, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  let resumes: Awaited<ReturnType<typeof getResumesWithStats>> = [];

  try {
    resumes = await getResumesWithStats();
  } catch (error) {
    console.error("[ResumesPage] Failed to load resumes:", error);
  }

  return (
    <div className="space-y-5 animate-slide-up">
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
        <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 ring-1 ring-indigo-100 dark:ring-indigo-800/50">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
          <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">{resumes.length} variants</span>
        </div>
      </div>
      <ResumeList resumes={resumes} />
    </div>
  );
}
