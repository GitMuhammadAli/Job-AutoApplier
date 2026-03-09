import { prisma } from "@/lib/prisma";

function normalizeCompanyName(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Company Email Cache: persist emails into CompanyEmail table,
 * then backfill all jobs from those companies that have no email.
 * The table persists across deploys — emails found once are reused forever.
 */
export async function backfillCompanyEmails(
  companyNames: string[],
): Promise<number> {
  if (companyNames.length === 0) return 0;

  const unique = Array.from(new Set(companyNames.map((c) => c.trim()).filter(Boolean)));
  if (unique.length === 0) return 0;

  let totalBackfilled = 0;

  // Step 1: Find high-confidence emails from GlobalJob and persist to CompanyEmail table
  const donors = await prisma.globalJob.findMany({
    where: {
      company: { in: unique, mode: "insensitive" },
      companyEmail: { not: null },
      emailConfidence: { gte: 70 },
      isActive: true,
    },
    select: { company: true, companyEmail: true, emailConfidence: true, emailSource: true },
    orderBy: { emailConfidence: "desc" },
  });

  const seenNorms = new Set<string>();
  for (const d of donors) {
    if (!d.companyEmail) continue;
    const norm = normalizeCompanyName(d.company);
    if (seenNorms.has(norm)) continue;
    seenNorms.add(norm);

    await prisma.companyEmail.upsert({
      where: { companyNorm: norm },
      create: {
        companyNorm: norm,
        companyDisplay: d.company,
        email: d.companyEmail,
        confidence: d.emailConfidence ?? 70,
        source: d.emailSource || "description_text",
      },
      update: {
        email: d.companyEmail,
        confidence: d.emailConfidence ?? 70,
        source: d.emailSource || "description_text",
        lastVerifiedAt: new Date(),
      },
    }).catch((err) => console.warn(`[EmailCache] Upsert failed for "${norm}":`, err));
  }

  // Step 2: Find all jobs with no email whose company exists in the cache
  const jobsWithoutEmail = await prisma.globalJob.findMany({
    where: {
      companyEmail: null,
      isActive: true,
      company: { in: unique, mode: "insensitive" },
    },
    select: { id: true, company: true },
  });

  if (jobsWithoutEmail.length === 0) return 0;

  // Step 3: Look up cached emails for those companies
  const companyNorms = Array.from(new Set(jobsWithoutEmail.map((j) => normalizeCompanyName(j.company))));
  const cached = await prisma.companyEmail.findMany({
    where: { companyNorm: { in: companyNorms } },
  });
  const cacheMap = new Map(cached.map((c) => [c.companyNorm, c]));

  // Step 4: Batch-update jobs grouped by normalized company
  const updatesByNorm = new Map<string, string[]>();
  for (const job of jobsWithoutEmail) {
    const norm = normalizeCompanyName(job.company);
    if (!cacheMap.has(norm)) continue;
    const ids = updatesByNorm.get(norm) || [];
    ids.push(job.id);
    updatesByNorm.set(norm, ids);
  }

  for (const [norm, ids] of Array.from(updatesByNorm.entries())) {
    const entry = cacheMap.get(norm);
    if (!entry) continue;
    try {
      const result = await prisma.globalJob.updateMany({
        where: { id: { in: ids } },
        data: {
          companyEmail: entry.email,
          emailConfidence: Math.min(entry.confidence, 75),
          emailSource: "company_db",
        },
      });
      totalBackfilled += result.count;
    } catch (err) {
      console.warn(`[EmailCache] Backfill failed for "${norm}":`, err);
    }
  }

  if (totalBackfilled > 0) {
    await prisma.systemLog.create({
      data: {
        type: "enrichment",
        source: "email-cache",
        message: `Backfilled ${totalBackfilled} jobs from CompanyEmail cache`,
        metadata: { backfilled: totalBackfilled, companies: unique.length, cached: cached.length },
      },
    }).catch(() => {});
  }

  return totalBackfilled;
}

/**
 * Cross-source deduplication: find new jobs that match existing jobs
 * from a DIFFERENT source by normalized (company + title).
 * Returns the set of sourceIds that are duplicates and should be
 * linked rather than created as new records.
 */
export async function findCrossSourceDuplicates(
  jobs: Array<{ title: string; company: string; source: string; sourceId: string }>,
): Promise<Map<string, string>> {
  if (jobs.length === 0) return new Map();

  // Build normalized keys for all incoming jobs
  const normalizedJobs = jobs.map((j) => ({
    ...j,
    normKey: normalizeForDedup(j.company, j.title),
  }));

  const companies = Array.from(new Set(jobs.map((j) => j.company.trim()).filter(Boolean)));
  if (companies.length === 0) return new Map();

  // Find existing active jobs from these companies (different source only)
  const existing = await prisma.globalJob.findMany({
    where: {
      company: { in: companies, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      company: true,
      source: true,
      sourceId: true,
      companyEmail: true,
      emailConfidence: true,
      description: true,
    },
  });

  // Build normKey → existing job map
  const existingByKey = new Map<string, typeof existing[0]>();
  for (const e of existing) {
    const key = normalizeForDedup(e.company, e.title);
    // Keep the one with the most data (prefer email, then longest description)
    const current = existingByKey.get(key);
    if (!current || isBetterRecord(e, current)) {
      existingByKey.set(key, e);
    }
  }

  // Map: incoming "source:sourceId" → existing job ID (the one to link to)
  const duplicates = new Map<string, string>();

  for (const job of normalizedJobs) {
    const match = existingByKey.get(job.normKey);
    if (match && match.source !== job.source) {
      duplicates.set(`${job.source}:${job.sourceId}`, match.id);
    }
  }

  return duplicates;
}

function normalizeForDedup(company: string, title: string): string {
  const c = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${c}::${t}`;
}

function isBetterRecord(
  a: { companyEmail: string | null; emailConfidence: number | null; description: string | null },
  b: { companyEmail: string | null; emailConfidence: number | null; description: string | null },
): boolean {
  if (a.companyEmail && !b.companyEmail) return true;
  if (!a.companyEmail && b.companyEmail) return false;
  if ((a.emailConfidence ?? 0) > (b.emailConfidence ?? 0)) return true;
  if ((a.description?.length ?? 0) > (b.description?.length ?? 0)) return true;
  return false;
}
