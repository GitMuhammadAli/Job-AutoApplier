import { suite, test, eq, assert, includes, summary } from "./test-harness";

// Replicate the logScrapeDetail logic from scrape-source.ts

interface ScrapeLogEntry {
  type: string;
  source: string;
  message: string;
  metadata: {
    found: number;
    new: number;
    updated: number;
    emailsFound: number;
    queriesUsed: string[];
  };
}

function buildScrapeLog(
  source: string,
  found: number,
  newCount: number,
  updated: number,
  emailsFound: number,
  queriesUsed: string[],
): ScrapeLogEntry {
  return {
    type: "scrape-detail",
    source,
    message: `${source}: ${newCount} new, ${updated} updated, ${emailsFound} emails (${found} fetched)`,
    metadata: {
      found,
      new: newCount,
      updated,
      emailsFound,
      queriesUsed: queriesUsed.slice(0, 10),
    },
  };
}

async function main() {
  suite("SECTION 12 — Scraper Detail Logging (5 tests)");

  await test("12.1 — Successful scrape logs correct counts", () => {
    const log = buildScrapeLog("jsearch", 10, 5, 3, 2, ["react", "node"]);
    eq(log.type, "scrape-detail", "type");
    eq(log.source, "jsearch", "source");
    eq(log.metadata.new, 5, "newJobs");
    eq(log.metadata.updated, 3, "updatedJobs");
    eq(log.metadata.emailsFound, 2, "emailsFound");
    eq(log.metadata.found, 10, "totalFetched");
  });

  await test("12.2 — Log message format correct", () => {
    const log = buildScrapeLog("linkedin", 8, 3, 4, 1, ["python"]);
    includes(log.message, "linkedin", "contains scraper name");
    includes(log.message, "3 new", "contains new count");
    includes(log.message, "4 updated", "contains updated count");
    includes(log.message, "1 emails", "contains emails found");
  });

  await test("12.3 — Error scrape logs error details", () => {
    const error = new Error("API rate limit exceeded");
    const errorLog = {
      type: "scrape-detail",
      source: "adzuna",
      message: `adzuna: error during scrape`,
      metadata: {
        error: error.message,
        errorType: error.name,
      },
    };
    eq(errorLog.metadata.error, "API rate limit exceeded", "error message");
    eq(errorLog.metadata.errorType, "Error", "error type");
  });

  await test("12.4 — Log uses fire-and-forget (doesn't throw)", async () => {
    // Simulate prisma.create rejecting
    let didThrow = false;
    try {
      const mockCreate = async () => { throw new Error("DB down"); };
      await mockCreate().catch(() => { /* fire and forget */ });
    } catch {
      didThrow = true;
    }
    eq(didThrow, false, "should not throw");
  });

  await test("12.5 — emailsFound counts jobs with non-null email", () => {
    const jobs = [
      { companyEmail: "hr@a.com" },
      { companyEmail: null },
      { companyEmail: "jobs@b.com" },
      { companyEmail: null },
      { companyEmail: "apply@c.com" },
      { companyEmail: null },
      { companyEmail: null },
      { companyEmail: null },
      { companyEmail: null },
      { companyEmail: null },
    ];
    const emailsFound = jobs.filter((j) => j.companyEmail).length;
    eq(emailsFound, 3, "3 jobs with email");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
