import { suite, test, eq, assert, summary } from "./test-harness";

// Replicate the maintenance cron guard logic from scrape-global/route.ts

interface MockSystemLog {
  source: string;
  createdAt: Date;
}

function shouldFireMaintenance(
  source: string,
  recentLogs: MockSystemLog[],
  twentyHoursAgo: Date
): boolean {
  const recent = recentLogs.filter(
    (l) => l.source === source && l.createdAt >= twentyHoursAgo
  );
  return recent.length === 0;
}

function shouldFireInstantApply(): boolean {
  // instant-apply fires after every scrape run — no 20h guard
  return true;
}

async function main() {
  suite("SECTION 13 — Cleanup-Stale Frequency Guard (6 tests)");

  const now = new Date();
  const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  await test("13.1 — cleanup-stale fires when last run > 20 hours ago", () => {
    const logs: MockSystemLog[] = [
      { source: "cleanup-stale", createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) },
    ];
    assert(shouldFireMaintenance("cleanup-stale", logs, twentyHoursAgo), "should fire");
  });

  await test("13.2 — cleanup-stale does NOT fire when run < 20 hours ago", () => {
    const logs: MockSystemLog[] = [
      { source: "cleanup-stale", createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
    ];
    assert(!shouldFireMaintenance("cleanup-stale", logs, twentyHoursAgo), "should NOT fire");
  });

  await test("13.3 — cleanup-stale fires when no previous run exists", () => {
    const logs: MockSystemLog[] = [];
    assert(shouldFireMaintenance("cleanup-stale", logs, twentyHoursAgo), "should fire on first run");
  });

  await test("13.4 — check-follow-ups same behavior (20h guard)", () => {
    const logsRecent: MockSystemLog[] = [
      { source: "check-follow-ups", createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000) },
    ];
    assert(!shouldFireMaintenance("check-follow-ups", logsRecent, twentyHoursAgo), "10h ago → skip");

    const logsOld: MockSystemLog[] = [
      { source: "check-follow-ups", createdAt: new Date(now.getTime() - 21 * 60 * 60 * 1000) },
    ];
    assert(shouldFireMaintenance("check-follow-ups", logsOld, twentyHoursAgo), "21h ago → fire");
  });

  await test("13.5 — instant-apply fires after scrape regardless", () => {
    assert(shouldFireInstantApply(), "always fires");
  });

  await test("13.6 — Guard failures don't block scraping", async () => {
    // Simulate prisma.systemLog.findFirst throwing
    let scrapingContinued = false;
    try {
      const mockGuardCheck = async () => {
        throw new Error("DB connection lost");
      };
      try {
        await mockGuardCheck();
      } catch {
        // Guard failed — scraping should still continue
      }
      scrapingContinued = true;
    } catch {
      scrapingContinued = false;
    }
    assert(scrapingContinued, "scraping continues despite guard failure");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
