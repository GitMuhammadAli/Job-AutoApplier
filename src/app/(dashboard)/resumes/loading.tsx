import { ResumesSkeleton } from "@/components/shared/Skeletons";
import { FileText } from "lucide-react";

export default function ResumesLoading() {
  return (
    <div className="space-y-5">
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
      <ResumesSkeleton />
    </div>
  );
}
