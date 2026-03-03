import { extractEmailFromText } from "../lib/extract-email-from-text";
import { suite, test, eq, assert, summary } from "./test-harness";

// Test the email extraction logic as used by scrapeAndUpsert.
// The scraper calls extractEmailFromText on job descriptions and decides
// whether to save/update the email. We replicate that logic here.

interface MockJob {
  companyEmail: string | null;
  description: string | null;
  emailSource?: string;
}

interface MockDbRecord {
  companyEmail: string | null;
  description: string | null;
}

function scraperExtractEmail(job: MockJob): MockJob {
  if (!job.companyEmail && job.description) {
    const extracted = extractEmailFromText(job.description);
    if (extracted.email) {
      job.companyEmail = extracted.email;
      job.emailSource = "description_text";
    }
  }
  return job;
}

function enrichExistingJob(
  dbRecord: MockDbRecord,
  newJob: MockJob,
  extraction: { email: string; confidence: number } | null
): { email?: string; emailSource?: string; description?: string } {
  const updates: { email?: string; emailSource?: string; description?: string } = {};
  if (extraction && !dbRecord.companyEmail) {
    updates.email = extraction.email;
    updates.emailSource = "description_text_rescrape";
  }
  if (newJob.description && newJob.description.length > (dbRecord.description?.length ?? 0)) {
    updates.description = newJob.description;
  }
  return updates;
}

async function main() {
  suite("SECTION 6 — Scraper Email Extraction (8 tests)");

  await test("6.1 — New job with description email extracts and saves it", () => {
    const job = scraperExtractEmail({ companyEmail: null, description: "Contact hr@firm.com for the role" });
    eq(job.companyEmail, "hr@firm.com", "companyEmail");
    eq(job.emailSource, "description_text", "emailSource");
  });

  await test("6.2 — New job without email saves correctly", () => {
    const job = scraperExtractEmail({ companyEmail: null, description: "Great opportunity in tech" });
    eq(job.companyEmail, null, "companyEmail should be null");
  });

  await test("6.3 — Existing job with email keeps original", () => {
    const dbRecord: MockDbRecord = { companyEmail: "existing@co.com", description: "old desc" };
    const newJob: MockJob = { companyEmail: null, description: "new desc with hr@new.com" };
    const extraction = { email: "hr@new.com", confidence: 95 };
    const updates = enrichExistingJob(dbRecord, newJob, extraction);
    // Should NOT update email because dbRecord already has one
    assert(updates.email === undefined, "should not overwrite existing email");
  });

  await test("6.4 — Existing job without email gets updated on rescrape", () => {
    const dbRecord: MockDbRecord = { companyEmail: null, description: "old desc" };
    const extraction = { email: "apply@newfirm.com", confidence: 90 };
    const newJob: MockJob = { companyEmail: null, description: "Apply to apply@newfirm.com" };
    const updates = enrichExistingJob(dbRecord, newJob, extraction);
    eq(updates.email, "apply@newfirm.com", "email updated");
    eq(updates.emailSource, "description_text_rescrape", "emailSource");
  });

  await test("6.5 — Longer description replaces shorter", () => {
    const dbRecord: MockDbRecord = { companyEmail: null, description: "short text 20 chars." };
    const newJob: MockJob = {
      companyEmail: null,
      description: "This is a much longer description that has more than 80 characters and provides more detail about the job.",
    };
    const updates = enrichExistingJob(dbRecord, newJob, null);
    eq(updates.description, newJob.description, "description updated to longer");
  });

  await test("6.6 — Shorter description does NOT replace longer", () => {
    const longDesc = "This is a much longer description that has more than 80 characters and provides more detail about the job.";
    const dbRecord: MockDbRecord = { companyEmail: null, description: longDesc };
    const newJob: MockJob = { companyEmail: null, description: "short" };
    const updates = enrichExistingJob(dbRecord, newJob, null);
    assert(updates.description === undefined, "should not replace with shorter description");
  });

  await test("6.7 — noreply excluded from description extraction", () => {
    const job = scraperExtractEmail({ companyEmail: null, description: "Contact noreply@company.com for questions" });
    eq(job.companyEmail, null, "noreply should be excluded");
  });

  await test("6.8 — Gmail in description not extracted", () => {
    const job = scraperExtractEmail({ companyEmail: null, description: "Email john@gmail.com for more info" });
    eq(job.companyEmail, null, "gmail should be excluded");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
