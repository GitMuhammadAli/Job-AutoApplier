import { notFound } from "next/navigation";
import { getJobById, getResumes } from "@/app/actions/job";
import { JobDetailClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [job, resumes] = await Promise.all([
    getJobById(params.id),
    getResumes(),
  ]);

  if (!job) notFound();

  return <JobDetailClient job={job} resumes={resumes} />;
}
