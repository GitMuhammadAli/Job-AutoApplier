import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { JobDetailClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let userId: string;
  try {
    userId = await getAuthUserId();
  } catch {
    notFound();
    return; // unreachable but keeps TS happy
  }

  let userJob;
  try {
    userJob = await prisma.userJob.findFirst({
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
    });
  } catch (error) {
    console.error("[JobDetail] DB error:", error);
    notFound();
    return;
  }

  if (!userJob) notFound();

  return <JobDetailClient job={userJob as any} />;
}
