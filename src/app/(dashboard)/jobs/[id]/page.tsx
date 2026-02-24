import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { JobDetailClient } from "./client";
import { getSettings } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { apply?: string };
}) {
  let userId: string;
  try {
    userId = await getAuthUserId();
  } catch {
    notFound();
    return;
  }

  let userJob;
  let userResumes: { id: string; name: string; isDefault: boolean }[] = [];
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  try {
    [userJob, userResumes, settings] = await Promise.all([
      prisma.userJob.findFirst({
        where: { id: params.id, userId },
        include: {
          globalJob: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true,
              description: true,
              salary: true,
              jobType: true,
              experienceLevel: true,
              category: true,
              skills: true,
              source: true,
              sourceUrl: true,
              applyUrl: true,
              companyUrl: true,
              companyEmail: true,
              emailConfidence: true,
              emailSource: true,
              postedDate: true,
            },
          },
          application: {
            include: {
              resume: { select: { id: true, name: true, fileName: true } },
            },
          },
          activities: {
            select: { id: true, type: true, description: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      }),
      prisma.resume.findMany({
        where: { userId, isDeleted: false },
        select: { id: true, name: true, isDefault: true },
        orderBy: { updatedAt: "desc" },
      }),
      getSettings().catch(() => null),
    ]);
  } catch (error) {
    console.error("[JobDetail] DB error:", error);
    notFound();
    return;
  }

  // If not found by UserJob ID, try as GlobalJob ID and auto-create UserJob
  if (!userJob) {
    try {
      const globalJob = await prisma.globalJob.findUnique({ where: { id: params.id } });
      if (globalJob) {
        const created = await prisma.userJob.upsert({
          where: { userId_globalJobId: { userId, globalJobId: globalJob.id } },
          create: { userId, globalJobId: globalJob.id, stage: "SAVED" },
          update: {},
          include: {
            globalJob: {
              select: {
                id: true,
                title: true,
                company: true,
                location: true,
                description: true,
                salary: true,
                jobType: true,
                experienceLevel: true,
                category: true,
                skills: true,
                source: true,
                sourceUrl: true,
                applyUrl: true,
                companyUrl: true,
                companyEmail: true,
                emailConfidence: true,
                emailSource: true,
                postedDate: true,
              },
            },
            application: {
              include: {
                resume: { select: { id: true, name: true, fileName: true } },
              },
            },
            activities: {
              select: { id: true, type: true, description: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
        });
        userJob = created;
      }
    } catch (error) {
      console.error("[JobDetail] GlobalJob lookup error:", error);
    }
  }

  if (!userJob) notFound();

  const profile = settings ? {
    fullName: settings.fullName ?? null,
    applicationEmail: settings.applicationEmail ?? null,
    phone: settings.phone ?? null,
    linkedinUrl: settings.linkedinUrl ?? null,
    portfolioUrl: settings.portfolioUrl ?? null,
    githubUrl: settings.githubUrl ?? null,
    experienceLevel: settings.experienceLevel ?? null,
    city: settings.city ?? null,
    country: settings.country ?? null,
  } : null;

  return (
    <JobDetailClient
      job={userJob as any}
      resumes={userResumes}
      autoApply={searchParams.apply === "true"}
      profile={profile}
    />
  );
}
