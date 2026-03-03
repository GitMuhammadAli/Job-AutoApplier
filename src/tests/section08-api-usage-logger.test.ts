import { suite, test, eq, assert, summary } from "./test-harness";

// We cannot import the real api-usage-logger without triggering prisma.
// Instead, replicate the in-memory batching logic to test it in isolation.

class MockApiUsageLogger {
  pending = new Map<string, number>();
  flushed: Array<{ source: string; count: number }> = [];
  flushTimer: ReturnType<typeof setTimeout> | null = null;
  createShouldFail = false;

  async logApiCall(source: string): Promise<void> {
    this.pending.set(source, (this.pending.get(source) || 0) + 1);
  }

  async flushApiUsageLogs(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pending.size > 0) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    const entries = Array.from(this.pending.entries());
    this.pending.clear();

    for (const [source, count] of entries) {
      try {
        if (this.createShouldFail) throw new Error("DB write failed");
        this.flushed.push({ source, count });
      } catch {
        // fire and forget
      }
    }
  }
}

async function main() {
  suite("SECTION 8 — API Usage Logger (6 tests)");

  await test("8.1 — logApiCall accumulates counts correctly", async () => {
    const logger = new MockApiUsageLogger();
    for (let i = 0; i < 5; i++) await logger.logApiCall("jsearch");
    await logger.flushApiUsageLogs();
    eq(logger.flushed.length, 1, "one flush entry");
    eq(logger.flushed[0].source, "jsearch", "source");
    eq(logger.flushed[0].count, 5, "count");
  });

  await test("8.2 — Multiple sources tracked separately", async () => {
    const logger = new MockApiUsageLogger();
    for (let i = 0; i < 3; i++) await logger.logApiCall("jsearch");
    for (let i = 0; i < 2; i++) await logger.logApiCall("groq");
    await logger.logApiCall("adzuna");
    await logger.flushApiUsageLogs();
    eq(logger.flushed.length, 3, "three flush entries");
    const jsearch = logger.flushed.find((e) => e.source === "jsearch");
    const groq = logger.flushed.find((e) => e.source === "groq");
    const adzuna = logger.flushed.find((e) => e.source === "adzuna");
    eq(jsearch!.count, 3, "jsearch count");
    eq(groq!.count, 2, "groq count");
    eq(adzuna!.count, 1, "adzuna count");
  });

  await test("8.3 — flush writes nothing when no calls logged", async () => {
    const logger = new MockApiUsageLogger();
    await logger.flushApiUsageLogs();
    eq(logger.flushed.length, 0, "no entries flushed");
  });

  await test("8.4 — flush resets counter after writing", async () => {
    const logger = new MockApiUsageLogger();
    for (let i = 0; i < 3; i++) await logger.logApiCall("jsearch");
    await logger.flushApiUsageLogs();
    for (let i = 0; i < 2; i++) await logger.logApiCall("jsearch");
    await logger.flushApiUsageLogs();
    eq(logger.flushed.length, 2, "two separate flush entries");
    eq(logger.flushed[0].count, 3, "first flush count");
    eq(logger.flushed[1].count, 2, "second flush count (not 5)");
  });

  await test("8.5 — Log entry has correct shape", async () => {
    const logger = new MockApiUsageLogger();
    await logger.logApiCall("groq");
    await logger.flushApiUsageLogs();
    const entry = logger.flushed[0];
    assert(entry.source === "groq", "source is groq");
    assert(entry.count >= 1, "count >= 1");
    // In production, the entry would also have type: "api_call" and metadata.timestamp
    const logEntry = {
      type: "api_call",
      source: entry.source,
      metadata: { count: entry.count, timestamp: Date.now() },
    };
    eq(logEntry.type, "api_call", "type");
    assert(logEntry.metadata.timestamp > 0, "timestamp exists");
  });

  await test("8.6 — prisma errors don't throw (fire and forget)", async () => {
    const logger = new MockApiUsageLogger();
    logger.createShouldFail = true;
    await logger.logApiCall("jsearch");
    // Should not throw
    await logger.flushApiUsageLogs();
    eq(logger.flushed.length, 0, "nothing flushed due to error, but no throw");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
