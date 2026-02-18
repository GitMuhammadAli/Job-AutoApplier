import { prisma } from "@/lib/prisma";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export async function isDuplicateApplication(
  userId: string,
  job: { title: string; company: string }
): Promise<boolean> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const existing = await prisma.jobApplication.findMany({
    where: {
      userId,
      status: { in: ["DRAFT", "READY", "SENDING", "SENT"] },
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      userJob: {
        include: {
          globalJob: { select: { title: true, company: true } },
        },
      },
    },
  });

  const jobCompanyNorm = normalizeCompany(job.company);

  for (const app of existing) {
    const gj = app.userJob.globalJob;
    const companyMatch = normalizeCompany(gj.company) === jobCompanyNorm;
    const titleMatch = titlesSimilar(gj.title, job.title);
    if (companyMatch && titleMatch) {
      return true;
    }
  }

  return false;
}
