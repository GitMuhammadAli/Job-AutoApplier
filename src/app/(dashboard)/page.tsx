import { getJobs } from "@/app/actions/job";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Zap, Clock, Mail, Settings, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const jobs = await getJobs();

  const todayJobs = jobs.filter((j) => {
    const d = new Date(j.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  if (jobs.length === 0) {
    return (
      <div className="space-y-5 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Job Pipeline</h1>
          <p className="mt-0.5 text-sm text-slate-500">Your automated job tracker</p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-5 mb-4 ring-1 ring-blue-100/50">
            <Sparkles className="h-10 w-10 text-blue-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Welcome to JobPilot</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
            Configure your profile in Settings, add your resumes, and jobs will start appearing here automatically from 8 sources.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 mt-6">
            <Button asChild>
              <Link href="/settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure Profile
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/resumes" className="gap-2">
                <FileText className="h-4 w-4" />
                Add Resumes
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Job Pipeline
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Drag cards between stages or use the arrows to move them.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 ring-1 ring-blue-100">
            <Zap className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold text-blue-700">{todayJobs} found today</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] font-medium text-slate-600">Daily scan</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 ring-1 ring-emerald-100">
            <Mail className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-700">Email per job</span>
          </div>
        </div>
      </div>

      <KanbanBoard initialJobs={jobs as any} />
    </div>
  );
}
