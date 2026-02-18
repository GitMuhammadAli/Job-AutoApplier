import { JobForm } from "@/components/jobs/JobForm";
import { Plus } from "lucide-react";

export default function AddJobPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-500/20">
            <Plus className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Job</h1>
        </div>
        <p className="text-sm text-slate-500">
          Manually track a job application. Auto-scraped jobs appear on the dashboard automatically.
        </p>
      </div>
      <JobForm />
    </div>
  );
}
