import { detectProvider } from "../lib/send-limiter";
import { suite, test, eq, assert, summary } from "./test-harness";

// Replicate the bounce counting logic from canSendNow for isolated testing.
// The actual function requires prisma + DB; we test the pure logic here.

const ADDRESS_BOUNCE_PATTERNS = [
  "address not found", "does not exist", "user unknown", "no such user",
  "mailbox not found", "mailbox unavailable", "invalid recipient",
  "recipient rejected", "undeliverable",
];

function countRealBounces(bouncedApps: Array<{ errorMessage: string | null }>): number {
  return bouncedApps.filter((app) => {
    if (!app.errorMessage) return false;
    const msg = app.errorMessage.toLowerCase();
    return ADDRESS_BOUNCE_PATTERNS.some((p) => msg.includes(p));
  }).length;
}

function shouldPause(bounceCount: number): boolean {
  return bounceCount >= 3;
}

function countSentOnly(apps: Array<{ status: string }>): number {
  return apps.filter((a) => a.status === "SENT").length;
}

async function main() {
  suite("SECTION 5 — Bounce Counter Logic (7 tests)");

  await test("5.1 — 3 address-not-found bounces triggers pause", () => {
    const bounces = [
      { errorMessage: "550 User unknown" },
      { errorMessage: "550 Mailbox does not exist" },
      { errorMessage: "553 Invalid recipient" },
    ];
    const count = countRealBounces(bounces);
    eq(count, 3, "bounce count");
    assert(shouldPause(count), "should trigger pause");
  });

  await test("5.2 — Policy rejection does NOT count", () => {
    const bounces = [
      { errorMessage: "550 User unknown" },
      { errorMessage: "550 Mailbox does not exist" },
      { errorMessage: "550 Message rejected due to spam policy" },
    ];
    const count = countRealBounces(bounces);
    eq(count, 2, "only 2 real bounces");
    assert(!shouldPause(count), "should NOT trigger pause");
  });

  await test("5.3 — Temporary failure does NOT count", () => {
    const bounces = [
      { errorMessage: "550 User unknown" },
      { errorMessage: "550 Mailbox does not exist" },
      { errorMessage: "421 Try again later" },
    ];
    const count = countRealBounces(bounces);
    eq(count, 2, "only 2 real bounces");
    assert(!shouldPause(count), "should NOT trigger pause");
  });

  await test("5.4 — Mixed bounces counted correctly", () => {
    const bounces = [
      { errorMessage: "550 User unknown" },
      { errorMessage: "550 User unknown" },
      { errorMessage: "421 Try later" },
      { errorMessage: "421 Try later" },
      { errorMessage: "421 Try later" },
      { errorMessage: "550 Blocked due to reputation" },
      { errorMessage: "550 Policy rejected" },
      { errorMessage: "550 Mailbox does not exist" },
    ];
    const count = countRealBounces(bounces);
    eq(count, 3, "3 real address bounces");
    assert(shouldPause(count), "should trigger pause at exactly 3");
  });

  await test("5.5 — Daily quota excludes BOUNCED", () => {
    const apps = [
      ...Array(5).fill({ status: "SENT" }),
      ...Array(10).fill({ status: "BOUNCED" }),
    ];
    eq(countSentOnly(apps), 5, "daily count = 5 SENT only");
  });

  await test("5.6 — Daily quota excludes FAILED", () => {
    const apps = [
      ...Array(8).fill({ status: "SENT" }),
      ...Array(15).fill({ status: "FAILED" }),
    ];
    eq(countSentOnly(apps), 8, "daily count = 8 SENT only");
  });

  await test("5.7 — detectProvider identifies providers correctly", () => {
    eq(detectProvider("gmail"), "gmail", "gmail provider");
    eq(detectProvider("outlook"), "outlook", "outlook provider");
    eq(detectProvider("brevo"), "brevo", "brevo provider");
    eq(detectProvider(null), "brevo", "null defaults to brevo");
    eq(detectProvider("default"), "brevo", "default maps to brevo");
    eq(detectProvider("custom", "smtp.gmail.com"), "gmail", "custom gmail host");
    eq(detectProvider("custom", "smtp.office365.com"), "outlook", "custom outlook host");
    eq(detectProvider("custom", "smtp.myserver.com"), "custom", "custom host");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
