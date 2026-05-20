import { Suspense } from "react";
import { ResumeOnboardingWizard } from "@/components/resumes/ResumeOnboardingWizard";
import { getResumesWithStats } from "@/app/actions/resume";

export const dynamic = "force-dynamic";

export default async function ResumeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const params = await searchParams;
  let uploadedResumes: Awaited<ReturnType<typeof getResumesWithStats>> = [];
  try {
    uploadedResumes = await getResumesWithStats();
  } catch {
    // proceed with empty list; wizard handles empty state
  }

  return (
    <Suspense fallback={null}>
      <ResumeOnboardingWizard
        initialPath={(params.path as "upload" | "scratch") ?? null}
        uploadedResumes={uploadedResumes}
      />
    </Suspense>
  );
}
