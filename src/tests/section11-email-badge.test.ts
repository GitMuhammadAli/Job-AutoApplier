import { suite, test, eq, assert, summary } from "./test-harness";

// Replicate badge and freshness logic from JobCard.tsx

type BadgeType = "verified" | "unverified" | "none";

function getBadgeType(companyEmail: string | null, emailConfidence: number | null): BadgeType {
  if (!companyEmail) return "none";
  if ((emailConfidence ?? 0) >= 80) return "verified";
  return "unverified";
}

function getBadgeStyle(badgeType: BadgeType): string {
  if (badgeType === "verified") return "emerald";
  if (badgeType === "unverified") return "amber";
  return "none";
}

// Replicate getFreshness from JobCard.tsx
function getFreshness(days: number | null): { label: string; dotColor: string } {
  if (days === null) return { label: "", dotColor: "" };
  if (days <= 1) return { label: "Fresh", dotColor: "green" };
  if (days <= 3) return { label: `${days}d ago`, dotColor: "yellow" };
  if (days <= 7) return { label: `${days}d ago`, dotColor: "orange" };
  if (days <= 14) return { label: `${days}d — may be filled`, dotColor: "orange" };
  return { label: `${days}d — likely expired`, dotColor: "red" };
}

function getDaysAgo(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

async function main() {
  suite("SECTION 11 — Email Badge Logic (10 tests)");

  await test("11.1 — High confidence email → 'verified' badge", () => {
    const badge = getBadgeType("hr@co.com", 95);
    eq(badge, "verified", "badge type");
    eq(getBadgeStyle(badge), "emerald", "green style");
  });

  await test("11.2 — Medium confidence email → 'unverified' badge", () => {
    const badge = getBadgeType("hr@co.com", 60);
    eq(badge, "unverified", "badge type");
    eq(getBadgeStyle(badge), "amber", "amber style");
  });

  await test("11.3 — Low confidence email → unverified", () => {
    const badge = getBadgeType("hr@co.com", 35);
    eq(badge, "unverified", "badge type");
  });

  await test("11.4 — No email → none", () => {
    const badge = getBadgeType(null, null);
    eq(badge, "none", "badge type");
  });

  await test("11.5 — Freshness dot: < 24h → green", () => {
    const days = getDaysAgo(new Date());
    const info = getFreshness(days);
    eq(info.dotColor, "green", "dot color");
  });

  await test("11.6 — Freshness dot: 48h → yellow", () => {
    const date = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const days = getDaysAgo(date);
    const info = getFreshness(days);
    eq(info.dotColor, "yellow", "dot color");
  });

  await test("11.7 — Freshness dot: 5 days → orange", () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const days = getDaysAgo(date);
    const info = getFreshness(days);
    eq(info.dotColor, "orange", "dot color");
  });

  await test("11.8 — Freshness dot: 8 days → orange (<=14)", () => {
    const date = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const days = getDaysAgo(date);
    const info = getFreshness(days);
    // JobCard.tsx: days <= 14 → orange, days > 14 → red
    eq(info.dotColor, "orange", "dot color for 8 days");
  });

  await test("11.9 — Null lastSeenAt falls back to createdAt", () => {
    const lastSeenAt = null;
    const createdAt = new Date();
    const effectiveDate = lastSeenAt || createdAt;
    const days = getDaysAgo(effectiveDate);
    const info = getFreshness(days);
    eq(info.dotColor, "green", "uses createdAt fallback");
  });

  await test("11.10 — Confidence boundary: exactly 80 → verified", () => {
    const badge = getBadgeType("hr@co.com", 80);
    eq(badge, "verified", "badge type at boundary");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
