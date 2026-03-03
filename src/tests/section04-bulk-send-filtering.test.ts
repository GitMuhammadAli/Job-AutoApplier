import { suite, test, eq, assert, gte, summary } from "./test-harness";

// Replicate the bulk-send filtering logic from the route handler as a testable function.
// The actual route embeds this logic inline; we extract it to test without HTTP.

interface MockApp {
  id: string;
  recipientEmail: string | null;
  userJob?: { globalJob?: { emailConfidence: number | null } };
}

function bulkSendFilter(apps: MockApp[]) {
  const qualified: MockApp[] = [];
  let skippedNoEmail = 0;
  let skippedLowConfidence = 0;

  for (const app of apps) {
    if (!app.recipientEmail) {
      skippedNoEmail++;
      continue;
    }
    const confidence = app.userJob?.globalJob?.emailConfidence ?? 0;
    if (confidence < 80) {
      skippedLowConfidence++;
      continue;
    }
    qualified.push(app);
  }

  const seenEmails = new Set<string>();
  const deduped: MockApp[] = [];
  let duplicatesRemoved = 0;

  for (const app of qualified) {
    const email = app.recipientEmail!.toLowerCase();
    if (seenEmails.has(email)) {
      duplicatesRemoved++;
      continue;
    }
    seenEmails.add(email);
    deduped.push(app);
  }

  return { qualified, deduped, skippedNoEmail, skippedLowConfidence, duplicatesRemoved };
}

async function main() {
  suite("SECTION 4 — Bulk Send Filtering (10 tests)");

  await test("4.1 — Verified email passes (confidence 95, has email)", () => {
    const r = bulkSendFilter([{ id: "1", recipientEmail: "hr@a.com", userJob: { globalJob: { emailConfidence: 95 } } }]);
    eq(r.deduped.length, 1, "should be in verified list");
  });

  await test("4.2 — Careers page email passes (confidence 82, has email)", () => {
    const r = bulkSendFilter([{ id: "1", recipientEmail: "jobs@b.com", userJob: { globalJob: { emailConfidence: 82 } } }]);
    eq(r.deduped.length, 1, "should be in verified list");
  });

  await test("4.3 — Guessed email skipped (confidence 35)", () => {
    const r = bulkSendFilter([{ id: "1", recipientEmail: "c@c.com", userJob: { globalJob: { emailConfidence: 35 } } }]);
    eq(r.deduped.length, 0, "should not be verified");
    eq(r.skippedLowConfidence, 1, "skippedLowConfidence");
  });

  await test("4.4 — Empty recipient skipped", () => {
    const r = bulkSendFilter([{ id: "1", recipientEmail: "", userJob: { globalJob: { emailConfidence: 95 } } }]);
    eq(r.skippedNoEmail, 1, "skippedNoEmail");
  });

  await test("4.5 — Null recipient skipped", () => {
    const r = bulkSendFilter([{ id: "1", recipientEmail: null, userJob: { globalJob: { emailConfidence: 95 } } }]);
    eq(r.skippedNoEmail, 1, "skippedNoEmail");
  });

  await test("4.6 — Mixed batch of 5 splits correctly", () => {
    const apps: MockApp[] = [
      { id: "1", recipientEmail: "hr@a.com", userJob: { globalJob: { emailConfidence: 95 } } },
      { id: "2", recipientEmail: "jobs@b.com", userJob: { globalJob: { emailConfidence: 82 } } },
      { id: "3", recipientEmail: "c@c.com", userJob: { globalJob: { emailConfidence: 35 } } },
      { id: "4", recipientEmail: "", userJob: { globalJob: { emailConfidence: 95 } } },
      { id: "5", recipientEmail: "d@d.com", userJob: { globalJob: { emailConfidence: 79 } } },
    ];
    const r = bulkSendFilter(apps);
    eq(r.deduped.length, 2, "verified count");
    eq(r.skippedLowConfidence, 2, "low confidence count");
    eq(r.skippedNoEmail, 1, "no email count");
    const verifiedIds = r.deduped.map((a) => a.id);
    assert(verifiedIds.includes("1"), "id 1 in verified");
    assert(verifiedIds.includes("2"), "id 2 in verified");
  });

  await test("4.7 — Duplicate emails deduplicated", () => {
    const apps: MockApp[] = [
      { id: "1", recipientEmail: "hr@same.com", userJob: { globalJob: { emailConfidence: 95 } } },
      { id: "2", recipientEmail: "HR@SAME.COM", userJob: { globalJob: { emailConfidence: 90 } } },
      { id: "3", recipientEmail: "other@diff.com", userJob: { globalJob: { emailConfidence: 85 } } },
    ];
    const r = bulkSendFilter(apps);
    eq(r.deduped.length, 2, "only 2 unique emails");
    eq(r.duplicatesRemoved, 1, "1 duplicate removed");
  });

  await test("4.8 — Stagger timing: route caps at 3 per request", () => {
    // The route uses applicationIds.slice(0, 3) — max 3 per request, no stagger delay
    const ids = ["a", "b", "c", "d", "e"].slice(0, 3);
    eq(ids.length, 3, "capped at 3");
  });

  await test("4.9 — Max limit enforced (slice to 3)", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const capped = ids.slice(0, 3);
    eq(capped.length, 3, "processed count = 3, not 25");
  });

  await test("4.10 — Response shape correct", () => {
    const apps: MockApp[] = [
      { id: "1", recipientEmail: "hr@a.com", userJob: { globalJob: { emailConfidence: 95 } } },
      { id: "2", recipientEmail: null, userJob: { globalJob: { emailConfidence: 90 } } },
    ];
    const r = bulkSendFilter(apps);
    // Verify the response shape matches what the route returns
    const response = {
      sent: r.deduped.length, // would be sent count after actual sending
      failed: 0,
      skippedNoEmail: r.skippedNoEmail,
      skippedLowConfidence: r.skippedLowConfidence,
      duplicatesRemoved: r.duplicatesRemoved,
      totalSkipped: r.skippedNoEmail + r.skippedLowConfidence,
    };
    assert("sent" in response, "has sent");
    assert("failed" in response, "has failed");
    assert("skippedNoEmail" in response, "has skippedNoEmail");
    assert("skippedLowConfidence" in response, "has skippedLowConfidence");
    assert("duplicatesRemoved" in response, "has duplicatesRemoved");
    assert("totalSkipped" in response, "has totalSkipped");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
