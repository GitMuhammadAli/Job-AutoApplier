import { getJobs } from "@/app/actions/job";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const jobs = await getJobs();

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Track and manage your job applications
        </p>
      </div>
      <KanbanBoard initialJobs={jobs} />
    </div>
  );
}
