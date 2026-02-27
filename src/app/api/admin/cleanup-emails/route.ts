import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const GUESSED_PREFIXES = ["careers@", "hr@", "jobs@", "hiring@", "apply@", "info@", "contact@"];

function isGuessedEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  return GUESSED_PREFIXES.some((p) => lower.startsWith(p));
}

function cleanJsonFromField(value: string, field: "subject" | "body"): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  if (!trimmed.startsWith("{") && !trimmed.includes('"subject"') && !trimmed.includes('"body"')) {
    return null;
  }

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && typeof parsed[field] === "string") {
      return parsed[field];
    }
  } catch { /* not valid JSON as-is */ }

  // Try fixing literal newlines inside JSON string values then parse
  try {
    const fixed = trimmed.replace(
      /(?<=:\s*")([\s\S]*?)(?="(?:\s*[,}]))/g,
      (m) => m.replace(/\r?\n/g, "\\n"),
    );
    const parsed = JSON.parse(fixed);
    if (typeof parsed === "object" && parsed !== null && typeof parsed[field] === "string") {
      return parsed[field].replace(/\\n/g, "\n");
    }
  } catch { /* still not parseable */ }

  // Regex extraction as last resort
  const pattern = field === "subject"
    ? /"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/
    : /"body"\s*:\s*"([\s\S]*)"\s*,?\s*}?\s*$/;
  const match = trimmed.match(pattern);
  if (match?.[1]) {
    let extracted = match[1];
    if (field === "body") {
      extracted = extracted.replace(/"\s*,?\s*}\s*$/, "");
    }
    return extracted
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return null;
}

export async function POST() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = {
      globalEmailsCleared: 0,
      guessedEmailsCleared: 0,
      jsonSubjectsCleaned: 0,
      jsonBodiesCleaned: 0,
      readyDowngraded: 0,
    };

    // 1. Clear guessed emails from GlobalJob
    const globalCleaned = await prisma.globalJob.updateMany({
      where: {
        OR: [
          { emailSource: { contains: "pattern_guess" } },
          { emailConfidence: { lt: 50 }, emailSource: { not: null } },
        ],
      },
      data: {
        companyEmail: null,
        emailSource: null,
        emailConfidence: null,
      },
    });
    stats.globalEmailsCleared = globalCleaned.count;

    // 2. Find all DRAFT/READY applications to check for guessed emails and JSON artifacts
    const drafts = await prisma.jobApplication.findMany({
      where: {
        status: { in: ["DRAFT", "READY"] },
      },
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        emailBody: true,
        emailConfidence: true,
      },
    });

    for (const draft of drafts) {
      const updates: Record<string, string> = {};

      // Check for guessed email in recipientEmail
      const hasGuessedEmail = draft.recipientEmail
        && isGuessedEmail(draft.recipientEmail)
        && (!draft.emailConfidence || draft.emailConfidence === "LOW" || draft.emailConfidence === "NONE");

      if (hasGuessedEmail) {
        updates.recipientEmail = "";
        updates.appliedVia = "MANUAL";
        stats.guessedEmailsCleared++;
      }

      // Check for JSON artifacts in subject
      const cleanedSubject = cleanJsonFromField(draft.subject, "subject");
      if (cleanedSubject !== null) {
        updates.subject = cleanedSubject;
        stats.jsonSubjectsCleaned++;
      }

      // Check for JSON artifacts in body
      const cleanedBody = cleanJsonFromField(draft.emailBody, "body");
      if (cleanedBody !== null) {
        updates.emailBody = cleanedBody;
        stats.jsonBodiesCleaned++;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.jobApplication.update({
          where: { id: draft.id },
          data: updates,
        });
      }
    }

    // 3. Downgrade READY applications that now have empty recipientEmail
    const readyDowngraded = await prisma.jobApplication.updateMany({
      where: {
        status: "READY",
        recipientEmail: "",
      },
      data: { status: "DRAFT" },
    });
    stats.readyDowngraded = readyDowngraded.count;

    return NextResponse.json({
      success: true,
      draftsScanned: drafts.length,
      ...stats,
    });
  } catch (error) {
    console.error("[cleanup-emails]", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 },
    );
  }
}
