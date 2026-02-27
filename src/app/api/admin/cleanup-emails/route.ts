import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Cleans up guessed emails from the database:
 * 1. GlobalJob records with emailSource containing "pattern_guess" — clears companyEmail
 * 2. JobApplication DRAFTs with recipientEmail that came from guesses — clears recipientEmail
 * 3. Does NOT touch SENT or SENDING applications
 */
export async function POST() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Clear guessed emails from GlobalJob where emailSource indicates a pattern guess
    const globalCleaned = await prisma.globalJob.updateMany({
      where: {
        emailSource: { contains: "pattern_guess" },
        emailConfidence: { lt: 50 },
      },
      data: {
        companyEmail: null,
        emailSource: null,
        emailConfidence: null,
      },
    });

    // Find draft/ready applications whose recipientEmail looks guessed
    // (common prefixes + low confidence tag)
    const guessedApps = await prisma.jobApplication.findMany({
      where: {
        status: { in: ["DRAFT", "READY"] },
        emailConfidence: "LOW",
        recipientEmail: { not: "" },
      },
      select: { id: true, recipientEmail: true },
    });

    let appsCleaned = 0;
    if (guessedApps.length > 0) {
      const result = await prisma.jobApplication.updateMany({
        where: {
          id: { in: guessedApps.map((a) => a.id) },
        },
        data: {
          recipientEmail: "",
          appliedVia: "MANUAL",
          emailConfidence: "NONE",
        },
      });
      appsCleaned = result.count;
    }

    // Also clear any READY applications that have empty recipientEmail
    // (shouldn't be READY without an email — downgrade to DRAFT)
    const readyNoEmail = await prisma.jobApplication.updateMany({
      where: {
        status: "READY",
        OR: [
          { recipientEmail: "" },
          { recipientEmail: null as unknown as string },
        ],
      },
      data: { status: "DRAFT" },
    });

    return NextResponse.json({
      success: true,
      globalJobsEmailsCleared: globalCleaned.count,
      draftEmailsCleared: appsCleaned,
      readyDowngradedToDraft: readyNoEmail.count,
      guessedEmailsFound: guessedApps.map((a) => a.recipientEmail),
    });
  } catch (error) {
    console.error("[cleanup-emails]", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 },
    );
  }
}
