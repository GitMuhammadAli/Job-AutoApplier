/**
 * Fix all job applications where emailBody or subject contains raw JSON or
 * markdown-wrapped JSON instead of plain text.
 *
 * Run: npx tsx src/scripts/fix-json-emails.ts
 */
import { prisma } from "../lib/prisma";

function extractCleanField(value: string, field: "subject" | "body"): string | null {
  if (!value) return null;

  // Strip markdown code fences
  let cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!cleaned.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null && typeof parsed[field] === "string") {
      return parsed[field];
    }
  } catch {
    // Try regex extraction for malformed JSON
    const pattern = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)(?:"\\s*[,}])`, "i");
    const match = cleaned.match(pattern);
    if (match) {
      return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }
  return null;
}

async function main() {
  console.log("Scanning for corrupted email data...\n");

  const apps = await prisma.jobApplication.findMany({
    select: { id: true, subject: true, emailBody: true },
  });

  let fixed = 0;

  for (const app of apps) {
    const updates: Record<string, string> = {};

    // Check emailBody for JSON or markdown-wrapped JSON
    if (app.emailBody) {
      const trimmed = app.emailBody.trim();
      const looksCorrupt =
        trimmed.startsWith("{") ||
        trimmed.startsWith("```json") ||
        trimmed.startsWith("```{");

      if (looksCorrupt) {
        const cleanBody = extractCleanField(app.emailBody, "body");
        if (cleanBody && cleanBody.length > 20) {
          updates.emailBody = cleanBody;

          // Also grab subject from the JSON if current subject is bad
          const jsonSubject = extractCleanField(app.emailBody, "subject");
          if (jsonSubject) {
            updates.subject = jsonSubject;
          }
        }
      }
    }

    // Check subject independently
    if (app.subject) {
      const trimmedSubj = app.subject.trim();
      if (trimmedSubj.startsWith("{") || trimmedSubj.startsWith("```")) {
        const cleanSubject = extractCleanField(app.subject, "subject");
        if (cleanSubject) {
          updates.subject = cleanSubject;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.jobApplication.update({
        where: { id: app.id },
        data: updates,
      });
      fixed++;
      console.log(`  FIXED [${app.id}]:`);
      if (updates.subject) console.log(`    Subject: "${updates.subject.slice(0, 80)}"`);
      if (updates.emailBody) console.log(`    Body: "${updates.emailBody.slice(0, 80)}..."`);
    }
  }

  console.log(`\nDone! Fixed: ${fixed}, Total scanned: ${apps.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
