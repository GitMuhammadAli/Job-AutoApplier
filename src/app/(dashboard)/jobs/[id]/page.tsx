import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { JobDetailClient } from "./client";

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
  try {
    [userJob, userResumes] = await Promise.all([
      prisma.userJob.findFirst({
        where: { id: params.id, userId },
        include: {
          globalJob: true,
          application: {
            include: {
              resume: { select: { id: true, name: true, fileName: true } },
            },
          },
          activities: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      }),
      prisma.resume.findMany({
        where: { userId, isDeleted: false },
        select: { id: true, name: true, isDefault: true },
        orderBy: { updatedAt: "desc" },
      }),
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
            globalJob: true,
            application: {
              include: {
                resume: { select: { id: true, name: true, fileName: true } },
              },
            },
            activities: { orderBy: { createdAt: "desc" }, take: 50 },
          },
        });
        userJob = created;
      }
    } catch (error) {
      console.error("[JobDetail] GlobalJob lookup error:", error);
    }
  }

  if (!userJob) notFound();

  return <JobDetailClient job={userJob as any} resumes={userResumes} autoApply={searchParams.apply === "true"} />;
}
