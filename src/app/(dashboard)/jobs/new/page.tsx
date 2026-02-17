import { getResumes } from "@/app/actions/job";
import { JobForm } from "@/components/jobs/JobForm";

export default async function AddJobPage() {
  const resumes = await getResumes();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Add Job</h1>
        <p className="text-sm text-slate-500">
          Track a new job application
        </p>
      </div>
      <JobForm resumes={resumes} mode="create" />
    </div>
  );
}
