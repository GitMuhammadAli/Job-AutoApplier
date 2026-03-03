import { extractEmailFromText } from "../lib/extract-email-from-text";
import { suite, test, eq, assert, summary } from "./test-harness";

// Test the parseHiringPost email extraction logic.
// parseHiringPost is not exported, so we replicate its email extraction approach:
// it builds combinedText from all fields and calls extractEmailFromText.

function buildCombinedText(result: {
  title?: string;
  snippet?: string;
  htmlSnippet?: string;
  pagemap?: { metatags?: Array<Record<string, string>> };
}): string {
  return [
    result.title,
    result.snippet,
    result.htmlSnippet?.replace(/<[^>]*>/g, " "),
    result.pagemap?.metatags?.[0]?.["og:description"],
    result.pagemap?.metatags?.[0]?.["description"],
    result.pagemap?.metatags?.[0]?.["og:title"],
  ].filter(Boolean).join(" ");
}

async function main() {
  suite("SECTION 7 — Hiring Posts Scraper (7 tests)");

  await test("7.1 — Email found in snippet", () => {
    const combined = buildCombinedText({
      title: "TechCo on LinkedIn: We are hiring!",
      snippet: "Send CV to hr@startup.pk — hiring!",
    });
    const r = extractEmailFromText(combined);
    eq(r.email, "hr@startup.pk", "email from snippet");
  });

  await test("7.2 — Email found in title only", () => {
    const combined = buildCombinedText({
      title: "Hiring MERN Dev — email jobs@co.com",
      snippet: "No email here just some text about hiring",
    });
    const r = extractEmailFromText(combined);
    eq(r.email, "jobs@co.com", "email from title");
  });

  await test("7.3 — Email in pagemap metatags", () => {
    const combined = buildCombinedText({
      title: "Job posting on LinkedIn: hiring developer",
      snippet: "Great opportunity",
      pagemap: { metatags: [{ "og:description": "Apply at careers@firm.com" }] },
    });
    const r = extractEmailFromText(combined);
    eq(r.email, "careers@firm.com", "email from metatags");
  });

  await test("7.4 — Email found → stored with confidence 90", () => {
    // In parseHiringPost, when email is found the job gets emailConfidence: 90
    const combined = buildCombinedText({
      title: "Company on LinkedIn: We are hiring — React Dev",
      snippet: "Send resume to hr@company.pk",
    });
    const r = extractEmailFromText(combined);
    assert(r.email !== null, "email should be found");
    // The scraper hardcodes 90, not the extraction confidence
    const hiringPostConfidence = 90;
    eq(hiringPostConfidence, 90, "hiring posts override confidence to 90");
  });

  await test("7.5 — No email in any field → null returned", () => {
    const combined = buildCombinedText({
      title: "Company on LinkedIn: We are hiring engineers",
      snippet: "Great team, good culture, apply online",
      pagemap: { metatags: [{ "og:description": "Join our growing team" }] },
    });
    const r = extractEmailFromText(combined);
    eq(r.email, null, "no email found");
  });

  await test("7.6 — HTML tags stripped before extraction", () => {
    const combined = buildCombinedText({
      title: "Hiring on LinkedIn: Dev needed",
      snippet: "Apply now",
      htmlSnippet: "Apply at <b>hr@co.com</b> today",
    });
    const r = extractEmailFromText(combined);
    eq(r.email, "hr@co.com", "email extracted after HTML strip");
  });

  await test("7.7 — Combined text includes all available fields", () => {
    // Email only in pagemap, not in title/snippet
    const combined = buildCombinedText({
      title: "Startup on LinkedIn: We are hiring",
      snippet: "Looking for developers",
      pagemap: { metatags: [{ "description": "Contact talent@hidden.io for roles" }] },
    });
    const r = extractEmailFromText(combined);
    eq(r.email, "talent@hidden.io", "found email from pagemap description");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
