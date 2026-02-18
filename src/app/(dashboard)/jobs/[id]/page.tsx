import { notFound } from "next/navigation";
import { getJobById } from "@/app/actions/job";
import { JobDetailClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    const job = await getJobById(params.id);
    return <JobDetailClient job={job as any} />;
  } catch {
    notFound();
  }
}
