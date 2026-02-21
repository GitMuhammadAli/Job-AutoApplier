import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/app/actions/settings";
import {
  jobMatchesPlatformPreferences,
  deduplicateUserJobsByLogicalJob,
} from "@/lib/matching/location-filter";
import { RecommendedClient } from "./client";

export const dynamic = "force-dynamic";

export default async function RecommendedPage() {
  const userId = await getAuthUserId();

  const [userJobsResult, settingsResult] = await Promise.allSettled([
    prisma.userJob.findMany({
      where: { userId, isDismissed: false },
      include: {
        globalJob: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            salary: true,
            jobType: true,
            experienceLevel: true,
            category: true,
            skills: true,
            source: true,
            applyUrl: true,
            sourceUrl: true,
            companyEmail: true,
            description: true,
            isFresh: true,
            postedDate: true,
            firstSeenAt: true,
            createdAt: true,
          },
        },
        application: {
          select: { id: true, status: true, sentAt: true },
        },
      },
      orderBy: { matchScore: "desc" },
      take: 200,
    }),
    getSettings(),
  ]);

  const userJobs =
    userJobsResult.status === "fulfilled" ? userJobsResult.value : [];
  const settings =
    settingsResult.status === "fulfilled" ? settingsResult.value : null;

  // Only filter by platform — location was already handled by the matching engine
  const filteredBySettings = userJobs.filter((j) => {
    if (!jobMatchesPlatformPreferences(j.globalJob.source, settings?.preferredPlatforms)) return false;
    return true;
  });
  const deduped = deduplicateUserJobsByLogicalJob(filteredBySettings);

  const serialized = deduped.map((j) => ({
    ...j,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    globalJob: {
      ...j.globalJob,
      createdAt: j.globalJob.createdAt.toISOString(),
      firstSeenAt: j.globalJob.firstSeenAt.toISOString(),
      postedDate: j.globalJob.postedDate?.toISOString() ?? null,
    },
    application: j.application
      ? {
          ...j.application,
          sentAt: j.application.sentAt?.toISOString() ?? null,
        }
      : null,
  }));

  return <RecommendedClient jobs={serialized as any} />;
}
