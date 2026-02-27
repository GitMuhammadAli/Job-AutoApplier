import { prisma } from "@/lib/prisma";
import { LIMITS } from "@/lib/constants";

export interface DuplicateResult {
  isDuplicate: boolean;
  reason?: string;
}

function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function checkDuplicate(
  userId: string,
  globalJob: { company: string; title: string; id: string },
): Promise<DuplicateResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const normCompany = normalizeCompany(globalJob.company);

  const recentApps = await prisma.jobApplication.findMany({
    where: {
      userId,
      // H8: Only active/successful statuses block — BOUNCED/FAILED shouldn't prevent re-applying
      status: { in: ["SENT", "SENDING", "READY"] },
      OR: [
        { sentAt: { gte: thirtyDaysAgo } },
        { sentAt: null, createdAt: { gte: thirtyDaysAgo } },
      ],
    },
    include: {
      userJob: {
        include: {
          globalJob: { select: { company: true, title: true, id: true } },
        },
      },
    },
    take: LIMITS.DUPLICATE_CHECK_BATCH,
  });

  for (const app of recentApps) {
    const gj = app.userJob.globalJob;
    const appCompany = normalizeCompany(gj.company);

    if (appCompany !== normCompany) continue;

    if (gj.id === globalJob.id) {
      return {
        isDuplicate: true,
        reason: `Already applied to this exact job at ${globalJob.company}`,
      };
    }

    const normNew = normalizeTitle(globalJob.title);
    const normExisting = normalizeTitle(gj.title);
    if (
      normNew === normExisting ||
      normNew.includes(normExisting) ||
      normExisting.includes(normNew)
    ) {
      const referenceDate = app.sentAt || app.createdAt;
      const daysAgo = Math.floor((Date.now() - referenceDate.getTime()) / 86400000);
      return {
        isDuplicate: true,
        reason: `Similar role at ${globalJob.company} ${app.sentAt ? "applied" : "queued"} ${daysAgo} days ago`,
      };
    }
  }

  return { isDuplicate: false };
}

/** Backward-compatible boolean helper */
export async function isDuplicateApplication(
  userId: string,
  job: { title: string; company: string },
): Promise<boolean> {
  const result = await checkDuplicate(userId, {
    ...job,
    id: "",
  });
  return result.isDuplicate;
}
