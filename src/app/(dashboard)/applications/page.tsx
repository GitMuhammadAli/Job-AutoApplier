import { getApplications, getApplicationCounts } from "@/app/actions/application";
import { ApplicationQueue } from "@/components/applications/ApplicationQueue";

export default async function ApplicationsPage() {
  const [applications, counts] = await Promise.all([
    getApplications(),
    getApplicationCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Application Queue
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your prepared applications before sending
        </p>
      </div>
      <ApplicationQueue
        applications={applications}
        counts={counts}
      />
    </div>
  );
}
