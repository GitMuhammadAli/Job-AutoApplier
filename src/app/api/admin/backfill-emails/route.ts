import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { extractEmailFromText } from "@/lib/extract-email-from-text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/backfill-emails
 *
 * Two operations:
 * 1. Scan all jobs with description but no companyEmail, extract emails
 * 2. Set confidence=85 on legacy emails that have companyEmail but no emailConfidence
 */
export async function POST() {
  const isAdminUser = await requireAdmin();
  if (!isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const BATCH_SIZE = 200;
  let emailsFound = 0;
  let legacyFixed = 0;
  let totalScanned = 0;
  let cursor: string | undefined;

  // Phase 1: Extract emails from descriptions of jobs that don't have one
  while (true) {
    const jobs = await prisma.globalJob.findMany({
      where: {
        companyEmail: null,
        description: { not: null },
      },
      select: { id: true, description: true, source: true },
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (jobs.length === 0) break;
    totalScanned += jobs.length;
    cursor = jobs[jobs.length - 1].id;

    for (const job of jobs) {
      if (!job.description) continue;
      const result = extractEmailFromText(job.description);
      if (result.email) {
        await prisma.globalJob.update({
          where: { id: job.id },
          data: {
            companyEmail: result.email,
            emailSource: "description_text_backfill",
            emailConfidence: result.confidence,
          },
        }).catch((err) => {
          console.warn(`[Backfill] Failed to update ${job.id}:`, err);
        });
        emailsFound++;
      }
    }
  }

  // Phase 2: Fix legacy emails that have no confidence score
  const legacyResult = await prisma.globalJob.updateMany({
    where: {
      companyEmail: { not: null },
      emailConfidence: null,
    },
    data: {
      emailConfidence: 85,
      emailSource: "legacy_regex",
    },
  });
  legacyFixed = legacyResult.count;

  await prisma.systemLog.create({
    data: {
      type: "admin",
      source: "backfill-emails",
      message: `Backfill complete: scanned ${totalScanned}, extracted ${emailsFound} new emails, fixed ${legacyFixed} legacy scores`,
      metadata: { totalScanned, emailsFound, legacyFixed },
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    totalScanned,
    emailsFound,
    legacyFixed,
  });
}
