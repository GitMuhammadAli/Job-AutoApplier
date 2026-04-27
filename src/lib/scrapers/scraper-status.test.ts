import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests the silent-zero detection logic in scraper-status.ts.
// Real-prod data showed Remotive/Arbeitnow/Adzuna running success/0 every
// time. The first version of the banner missed these (only flagged failed/
// timeout). Pin the new behaviour: 3+ consecutive zero successes = broken.

const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scraperRun: {
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

import { getRecentScraperFailures } from "./scraper-status";

const now = new Date();
const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);

function run(source: string, status: string, jobsFound: number, ageMin = 5, errorMessage: string | null = null) {
  return { source, status, jobsFound, errorMessage, startedAt: ago(ageMin) };
}

describe("getRecentScraperFailures", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("flags a source with 3+ consecutive zero-success runs", async () => {
    mockFindMany.mockResolvedValueOnce([
      run("remotive", "success", 0, 5),
      run("remotive", "success", 0, 65),
      run("remotive", "success", 0, 125),
      run("remotive", "success", 0, 185),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].source).toBe("remotive");
    expect(failures[0].consecutiveFailures).toBeGreaterThanOrEqual(3);
  });

  it("does NOT flag a source with only 1 zero run", async () => {
    mockFindMany.mockResolvedValueOnce([
      run("rozee", "success", 0, 5),
      run("rozee", "success", 50, 65),
      run("rozee", "success", 30, 125),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures).toHaveLength(0);
  });

  it("flags an errored source even on a single run", async () => {
    mockFindMany.mockResolvedValueOnce([
      run("linkedin", "failed", 0, 5, "captcha detected"),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].source).toBe("linkedin");
    expect(failures[0].reason).toMatch(/captcha|login wall/i);
  });

  it("flags a timeout immediately and uses a timeout-specific reason", async () => {
    mockFindMany.mockResolvedValueOnce([
      run("google", "timeout", 0, 5, "Timeout after 25000ms"),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toMatch(/timeout|too long/i);
  });

  it("recognises auth/key errors and explains them", async () => {
    mockFindMany.mockResolvedValueOnce([
      run("indeed", "failed", 0, 5, "401 Unauthorized: missing api key"),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures[0].reason).toMatch(/api key|env vars|missing/i);
  });

  it("returns empty array when all sources are healthy", async () => {
    mockFindMany.mockResolvedValueOnce([
      run("rozee", "success", 50, 5),
      run("linkedin", "success", 30, 5),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures).toEqual([]);
  });

  it("sorts by consecutiveFailures descending so the worst offender is first", async () => {
    mockFindMany.mockResolvedValueOnce([
      ...Array.from({ length: 5 }, (_, i) => run("arbeitnow", "success", 0, 5 + i * 60)),
      run("indeed", "failed", 0, 5, "rate-limited"),
      run("indeed", "success", 10, 65),
    ]);
    const failures = await getRecentScraperFailures();
    expect(failures[0].source).toBe("arbeitnow");
    expect(failures[0].consecutiveFailures).toBeGreaterThan(failures[1].consecutiveFailures);
  });
});
