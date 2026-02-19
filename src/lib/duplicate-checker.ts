import { prisma } from "@/lib/prisma";

export interface DuplicateResult {
  isDuplicate: boolean;
  reason?: string;
}

function normalizeCompany(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function checkDuplicate(
  userId: string,
  globalJob: { company: string; title: string; id: string }
): Promise<DuplicateResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const normCompany = normalizeCompany(globalJob.company);

  const recentApps = await prisma.jobApplication.findMany({
    where: {
      userId,
      status: { in: ["SENT", "SENDING", "READY"] },
      sentAt: { gte: sevenDaysAgo },
    },
    include: {
      userJob: {
        include: {
          globalJob: { select: { company: true, title: true, id: true } },
        },
      },
    },
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
      const daysAgo = app.sentAt
        ? Math.floor((Date.now() - app.sentAt.getTime()) / 86400000)
        : 0;
      return {
        isDuplicate: true,
        reason: `Similar role at ${globalJob.company} applied ${daysAgo} days ago`,
      };
    }
  }

  return { isDuplicate: false };
}

/** Backward-compatible boolean helper */
export async function isDuplicateApplication(
  userId: string,
  job: { title: string; company: string }
): Promise<boolean> {
  const result = await checkDuplicate(userId, {
    ...job,
    id: "",
  });
  return result.isDuplicate;
}
