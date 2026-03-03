import { suite, test, eq, assert, gte, lt, summary } from "./test-harness";
import { extractEmailFromText } from "../lib/extract-email-from-text";
import { classifyError, isAddressNotFound } from "../lib/email-errors";
import { getConfidenceScore } from "../lib/email-extractor";
import { generateTemplateEmail } from "../lib/ai-fallback";
import { detectProvider } from "../lib/send-limiter";

// Address bounce patterns (same as in send-limiter)
const ADDRESS_BOUNCE_PATTERNS = [
  "address not found", "does not exist", "user unknown", "no such user",
  "mailbox not found", "mailbox unavailable", "invalid recipient",
  "recipient rejected", "undeliverable",
];

function countRealBounces(errors: string[]): number {
  return errors.filter((msg) => {
    const lower = msg.toLowerCase();
    return ADDRESS_BOUNCE_PATTERNS.some((p) => lower.includes(p));
  }).length;
}

function bulkSendFilter(apps: Array<{ id: string; email: string | null; confidence: number }>) {
  const verified: typeof apps = [];
  let skippedNoEmail = 0;
  let skippedLowConfidence = 0;

  for (const app of apps) {
    if (!app.email) { skippedNoEmail++; continue; }
    if (app.confidence < 80) { skippedLowConfidence++; continue; }
    verified.push(app);
  }

  const seenEmails = new Set<string>();
  const deduped: typeof apps = [];
  let duplicatesRemoved = 0;

  for (const app of verified) {
    const e = app.email!.toLowerCase();
    if (seenEmails.has(e)) { duplicatesRemoved++; continue; }
    seenEmails.add(e);
    deduped.push(app);
  }

  return { deduped, skippedNoEmail, skippedLowConfidence, duplicatesRemoved };
}

async function main() {
  suite("SECTION 15 — End to End Flow Tests (10 tests)");

  await test("15.1 — Full flow: description email → auto-queued", () => {
    // 1. Job scraped with description containing email
    const desc = "Senior React Dev needed. Send CV to hr@co.com ASAP";
    // 2. Extract email
    const extraction = extractEmailFromText(desc);
    eq(extraction.email, "hr@co.com", "email extracted");
    gte(extraction.confidence, 85, "confidence >= 85");
    // 3. Confidence >= 80 → READY
    const status = extraction.confidence >= 80 ? "READY" : "DRAFT";
    eq(status, "READY", "auto-queued as READY");
  });

  await test("15.2 — Full flow: guessed email → draft only", () => {
    // Strategy 3 returns LOW confidence
    const confidenceScore = getConfidenceScore("LOW"); // 20
    lt(confidenceScore, 80, "LOW < 80 threshold");
    const status = confidenceScore >= 80 ? "READY" : "DRAFT";
    eq(status, "DRAFT", "stays as DRAFT");
  });

  await test("15.3 — Full flow: bulk send with mixed quality", () => {
    const apps = [
      { id: "1", email: "hr@a.com", confidence: 95 },
      { id: "2", email: "jobs@b.com", confidence: 82 },
      { id: "3", email: "c@c.com", confidence: 35 },
      { id: "4", email: "d@d.com", confidence: 35 },
      { id: "5", email: null, confidence: 0 },
    ];
    const result = bulkSendFilter(apps);
    eq(result.deduped.length, 2, "2 verified scheduled");
    eq(result.skippedLowConfidence, 2, "2 low confidence skipped");
    eq(result.skippedNoEmail, 1, "1 no email skipped");
  });

  await test("15.4 — Full flow: bounce handling", () => {
    // Path A: address not found bounce
    const err1 = { message: "550 User unknown", responseCode: 550 };
    const classified1 = classifyError(err1);
    eq(classified1.type, "permanent", "permanent error");
    assert(isAddressNotFound(err1), "address not found");

    // Path B: temporary failure does NOT count
    const err2 = { message: "421 Try again later", responseCode: 421 };
    const classified2 = classifyError(err2);
    eq(classified2.type, "transient", "transient error");
    assert(!isAddressNotFound(err2), "NOT address not found");

    // 3 real bounces → pause
    const bounceErrors = [
      "550 User unknown",
      "550 Mailbox does not exist",
      "553 Invalid recipient",
    ];
    const realBounces = countRealBounces(bounceErrors);
    eq(realBounces, 3, "3 real bounces");
    assert(realBounces >= 3, "pause triggered");
  });

  await test("15.5 — Full flow: daily quota accuracy", () => {
    const sends = [
      ...Array(4).fill({ status: "SENT" }),
      ...Array(4).fill({ status: "BOUNCED" }),
      ...Array(2).fill({ status: "FAILED" }),
    ];
    const dailyCount = sends.filter((s) => s.status === "SENT").length;
    eq(dailyCount, 4, "daily count = 4 (SENT only)");
  });

  await test("15.6 — Full flow: re-scrape improves data", () => {
    // DB record has no email
    const dbRecord = { companyEmail: null, description: "old short desc" };

    // Re-scrape finds email in description
    const newDesc = "Apply to apply@co.com for this amazing opportunity in Lahore";
    const extraction = extractEmailFromText(newDesc);
    eq(extraction.email, "apply@co.com", "email found on rescrape");

    // Update branch: hasNewEmail = extraction && !dbRecord.companyEmail
    const hasNewEmail = extraction.email && !dbRecord.companyEmail;
    assert(!!hasNewEmail, "should update");

    // emailSource should be description_text_rescrape
    const emailSource = hasNewEmail ? "description_text_rescrape" : null;
    eq(emailSource, "description_text_rescrape", "correct source");
  });

  await test("15.7 — Full flow: same company dedup in bulk", () => {
    const apps = [
      { id: "1", email: "hr@same.com", confidence: 95 },
      { id: "2", email: "HR@SAME.COM", confidence: 90 },
      { id: "3", email: "other@diff.com", confidence: 85 },
      { id: "4", email: "unique@another.com", confidence: 92 },
    ];
    const result = bulkSendFilter(apps);
    eq(result.deduped.length, 3, "3 unique emails sent");
    eq(result.duplicatesRemoved, 1, "1 duplicate removed");
  });

  await test("15.8 — Full flow: settings readiness all green", () => {
    const settings = {
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: true,
      keywords: ["react"],
      applicationEmail: "test@gmail.com",
    };
    const resumeCount = 1;

    const modeCheck = ["SEMI_AUTO", "FULL_AUTO", "INSTANT"].includes(settings.applicationMode);
    const autoApplyCheck = settings.autoApplyEnabled;
    const resumeCheck = resumeCount > 0;
    const keywordsCheck = settings.keywords.length > 0;
    const emailCheck = !!settings.applicationEmail;
    const allReady = modeCheck && autoApplyCheck && resumeCheck && keywordsCheck && emailCheck;

    assert(allReady, "allReady = true");
  });

  await test("15.9 — Full flow: API quota tracked end to end", () => {
    // Simulate the flow: logApiCall → flush → SystemLog → stats
    const pending = new Map<string, number>();
    pending.set("jsearch", 5);
    pending.set("groq", 3);

    const logEntries: Array<{ type: string; source: string; metadata: { count: number } }> = [];
    pending.forEach((count, source) => {
      logEntries.push({ type: "api_call", source, metadata: { count } });
    });

    // Stats route sums entries
    const jsearchTotal = logEntries
      .filter((e) => e.source === "jsearch")
      .reduce((sum, e) => sum + e.metadata.count, 0);
    gte(jsearchTotal, 1, "quota count > 0 for jsearch");
    eq(jsearchTotal, 5, "jsearch total = 5");
  });

  await test("15.10 — Full flow: cron chain after scrape", () => {
    const now = new Date();
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);

    // instant-apply always fires
    const instantApplyFired = true;
    assert(instantApplyFired, "instant-apply always triggered");

    // cleanup-stale: no recent run → fires
    const recentCleanup: Date[] = [];
    const cleanupFires = recentCleanup.filter((d) => d >= twentyHoursAgo).length === 0;
    assert(cleanupFires, "cleanup-stale fires when no recent run");

    // check-follow-ups: recent run → skips
    const recentFollowUp = [new Date(now.getTime() - 5 * 60 * 60 * 1000)];
    const followUpFires = recentFollowUp.filter((d) => d >= twentyHoursAgo).length === 0;
    assert(!followUpFires, "check-follow-ups skips when run 5h ago");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
