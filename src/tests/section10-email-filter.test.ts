import { suite, test, eq, assert, summary } from "./test-harness";

// Replicate the email filter logic from recommended/client.tsx

interface MockJob {
  id: string;
  companyEmail: string | null;
  emailConfidence: number | null;
  source?: string;
}

function emailCounts(jobs: MockJob[]) {
  return {
    all: jobs.length,
    verified: jobs.filter((j) => j.companyEmail && (j.emailConfidence ?? 0) >= 80).length,
    none: jobs.filter((j) => !j.companyEmail).length,
  };
}

function filterByEmail(jobs: MockJob[], filter: "all" | "verified" | "none"): MockJob[] {
  if (filter === "verified") return jobs.filter((j) => j.companyEmail && (j.emailConfidence ?? 0) >= 80);
  if (filter === "none") return jobs.filter((j) => !j.companyEmail);
  return jobs;
}

function filterBySource(jobs: MockJob[], source: string): MockJob[] {
  return jobs.filter((j) => j.source === source);
}

async function main() {
  suite("SECTION 10 — Email Filter Logic (8 tests)");

  const baseJobs: MockJob[] = [
    { id: "1", companyEmail: "hr@a.com", emailConfidence: 95 },
    { id: "2", companyEmail: "jobs@b.com", emailConfidence: 82 },
    { id: "3", companyEmail: "x@c.com", emailConfidence: 35 },
    { id: "4", companyEmail: null, emailConfidence: 0 },
  ];

  await test("10.1 — 'verified' filter shows only high-confidence emails", () => {
    const result = filterByEmail(baseJobs, "verified");
    eq(result.length, 2, "2 verified jobs");
    assert(result.some((j) => j.id === "1"), "id 1 included");
    assert(result.some((j) => j.id === "2"), "id 2 included");
  });

  await test("10.2 — 'none' filter shows only no-email jobs", () => {
    const result = filterByEmail(baseJobs, "none");
    eq(result.length, 1, "1 no-email job");
    eq(result[0].id, "4", "id 4");
  });

  await test("10.3 — 'all' filter shows everything", () => {
    const result = filterByEmail(baseJobs, "all");
    eq(result.length, 4, "all 4 jobs");
  });

  await test("10.4 — Counts are correct", () => {
    const counts = emailCounts(baseJobs);
    eq(counts.all, 4, "all count");
    eq(counts.verified, 2, "verified count");
    eq(counts.none, 1, "none count");
  });

  await test("10.5 — Filter works alongside other active filters", () => {
    const jobsWithSources: MockJob[] = [
      { id: "1", companyEmail: "hr@a.com", emailConfidence: 95, source: "linkedin" },
      { id: "2", companyEmail: "jobs@b.com", emailConfidence: 82, source: "linkedin" },
      { id: "3", companyEmail: "x@c.com", emailConfidence: 35, source: "linkedin" },
      { id: "4", companyEmail: null, emailConfidence: 0, source: "indeed" },
      { id: "5", companyEmail: "hr@d.com", emailConfidence: 90, source: "linkedin" },
    ];
    const linkedinJobs = filterBySource(jobsWithSources, "linkedin");
    eq(linkedinJobs.length, 4, "4 linkedin jobs after source filter");
    const verified = filterByEmail(linkedinJobs, "verified");
    eq(verified.length, 3, "3 verified from linkedin");
  });

  await test("10.6 — Count updates when other filters change", () => {
    const jobsWithSources: MockJob[] = [
      { id: "1", companyEmail: "hr@a.com", emailConfidence: 95, source: "linkedin" },
      { id: "2", companyEmail: "jobs@b.com", emailConfidence: 82, source: "indeed" },
      { id: "3", companyEmail: null, emailConfidence: 0, source: "linkedin" },
      { id: "4", companyEmail: "x@c.com", emailConfidence: 35, source: "linkedin" },
    ];
    const linkedinOnly = filterBySource(jobsWithSources, "linkedin");
    const counts = emailCounts(linkedinOnly);
    eq(counts.all, 3, "all from linkedin = 3");
    eq(counts.verified, 1, "verified from linkedin = 1");
    eq(counts.none, 1, "none from linkedin = 1");
  });

  await test("10.7 — Confidence exactly 80 included in verified", () => {
    const jobs: MockJob[] = [{ id: "1", companyEmail: "hr@co.com", emailConfidence: 80 }];
    const result = filterByEmail(jobs, "verified");
    eq(result.length, 1, "boundary 80 included");
  });

  await test("10.8 — Confidence 79 excluded from verified", () => {
    const jobs: MockJob[] = [{ id: "1", companyEmail: "hr@co.com", emailConfidence: 79 }];
    const result = filterByEmail(jobs, "verified");
    eq(result.length, 0, "79 excluded");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
