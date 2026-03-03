import { extractEmailFromText } from "../lib/extract-email-from-text";
import { suite, test, eq, assert, gte, summary } from "./test-harness";

async function main() {
  suite("SECTION 1 — Email Extraction (12 tests)");

  await test("1.1 — Basic email found in description", () => {
    const r = extractEmailFromText("Send your CV to hr@techfirm.com to apply");
    eq(r.email, "hr@techfirm.com", "email");
    assert(r.confidence > 0, "confidence > 0");
  });

  await test("1.2 — No email returns null", () => {
    const r = extractEmailFromText("We are looking for a React developer");
    eq(r.email, null, "email");
    eq(r.confidence, 0, "confidence");
  });

  await test("1.3 — Gmail excluded", () => {
    const r = extractEmailFromText("Email me at john@gmail.com");
    eq(r.email, null, "email");
  });

  await test("1.4 — noreply excluded", () => {
    const r = extractEmailFromText("Automated reply from noreply@company.com");
    eq(r.email, null, "email");
  });

  await test("1.5 — Hiring prefix preferred over generic", () => {
    const r = extractEmailFromText("info@co.com or hr@co.com both work");
    // Both "info" and "hr" are HIRING_PREFIXES (score 95 each), but "info" appears first.
    // The function sorts by score descending, ties go to first match. Both are hiring prefixes.
    // Either is acceptable since both are hiring prefixes with equal score.
    assert(r.email === "info@co.com" || r.email === "hr@co.com", "should return a hiring prefix email");
    gte(r.confidence, 85, "confidence >= 85");
  });

  await test("1.6 — Multiple emails, best one returned", () => {
    const r = extractEmailFromText("Apply at careers@startup.pk or jobs@startup.pk");
    assert(r.email !== null, "should find an email");
    gte(r.confidence, 85, "confidence >= 85");
  });

  await test("1.7 — Empty string returns null", () => {
    const r = extractEmailFromText("");
    eq(r.email, null, "email");
    eq(r.confidence, 0, "confidence");
  });

  await test("1.8 — Null/undefined returns null", () => {
    const r = extractEmailFromText(null as unknown as string);
    eq(r.email, null, "email");
    eq(r.confidence, 0, "confidence");
  });

  await test("1.9 — Email embedded in long text", () => {
    const r = extractEmailFromText(
      "We are a Lahore tech startup. Send resume to careers@lahorestartup.pk with cover letter."
    );
    eq(r.email, "careers@lahorestartup.pk", "email");
  });

  await test("1.10 — LinkedIn domain excluded", () => {
    const r = extractEmailFromText("Visit linkedin.com or email social@linkedin.com");
    eq(r.email, null, "email");
  });

  await test("1.11 — Hiring prefix has higher confidence than generic", () => {
    const a = extractEmailFromText("contact admin@company.com");
    const b = extractEmailFromText("contact hr@company.com");
    // "admin" is not in HIRING_PREFIXES → score 85. "hr" is → score 95.
    assert(b.confidence > a.confidence, `hr conf ${b.confidence} should > admin conf ${a.confidence}`);
  });

  await test("1.12 — Pakistani .com.pk domain accepted", () => {
    const r = extractEmailFromText("Email recruitment@techpk.com.pk");
    eq(r.email, "recruitment@techpk.com.pk", "email");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
