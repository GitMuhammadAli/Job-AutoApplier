import { getResumesWithStats } from "@/app/actions/resume";
import { ResumeList } from "@/components/resumes/ResumeList";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const resumes = await getResumesWithStats();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Resume Manager</h1>
        <p className="text-sm text-slate-500">
          Manage resume variants and track which ones get the best response rate
        </p>
      </div>
      <ResumeList resumes={resumes} />
    </div>
  );
}
