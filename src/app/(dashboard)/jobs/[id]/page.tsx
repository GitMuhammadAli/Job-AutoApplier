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
  try {
    const userId = await getAuthUserId();

    const userJob = await prisma.userJob.findFirst({
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

    if (!userJob) notFound();

    return <JobDetailClient job={userJob as any} />;
  } catch {
    notFound();
  }
}
