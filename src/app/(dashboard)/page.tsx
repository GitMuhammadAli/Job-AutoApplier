import { getJobs } from "@/app/actions/job";
import { getSettings } from "@/app/actions/settings";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Zap, Clock, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [jobs, settings] = await Promise.all([getJobs(), getSettings()]);

  if (!settings.isOnboarded) {
    return (
      <div className="animate-slide-up">
        <OnboardingWizard />
      </div>
    );
  }

  const todayJobs = jobs.filter((j) => {
    const d = new Date(j.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

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
