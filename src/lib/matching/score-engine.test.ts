import { describe, it, expect } from "vitest";
import {
  parseSalaryRange,
  keywordMatchesText,
  normalizeText,
  expandStackAcronyms,
} from "./score-engine";

describe("parseSalaryRange — Bug #10 regression: 'competitive' only rejected when no digits", () => {
  it("parses simple range with $ prefix", () => {
    const r = parseSalaryRange("$80,000 - $120,000");
    expect(r).not.toBeNull();
    expect(r!.min).toBeGreaterThan(0);
    expect(r!.max).toBeGreaterThanOrEqual(r!.min);
  });

  it("parses K-suffix shorthand", () => {
    const r = parseSalaryRange("$80k-$120k");
    expect(r).not.toBeNull();
    expect(r!.min).toBe(80_000);
    expect(r!.max).toBe(120_000);
  });

  it("parses lowercase k", () => {
    const r = parseSalaryRange("80k - 120k usd");
    expect(r).not.toBeNull();
  });

  it("parses single number as min=max", () => {
    const r = parseSalaryRange("$95k");
    expect(r).not.toBeNull();
    expect(r!.min).toBe(95_000);
    expect(r!.max).toBe(95_000);
  });

  it("parses lakh suffix (Indian numbering)", () => {
    const r = parseSalaryRange("8 lakh - 12 lakh");
    expect(r!.min).toBe(800_000);
    expect(r!.max).toBe(1_200_000);
  });

  it("parses lac (alt spelling)", () => {
    const r = parseSalaryRange("8 lac - 12 lac");
    expect(r!.min).toBe(800_000);
    expect(r!.max).toBe(1_200_000);
  });

  it("parses cr (crore) suffix", () => {
    const r = parseSalaryRange("1 cr per year");
    // 10M / 12 = 833,333.33 — function rounds to integer
    expect(r!.min).toBe(Math.round(10_000_000 / 12));
  });

  it("converts yearly to monthly when 'year' or 'annual' present", () => {
    const r = parseSalaryRange("$120,000 per year");
    expect(r!.min).toBe(10_000); // 120k / 12
  });

  it("converts hourly to monthly when 'hour' or '/hr' present", () => {
    const r = parseSalaryRange("$50/hr");
    expect(r!.min).toBe(8_000); // 50 * 160
  });

  it("REJECTS 'negotiable' alone", () => {
    expect(parseSalaryRange("Negotiable")).toBeNull();
  });

  it("REJECTS 'not specified' alone", () => {
    expect(parseSalaryRange("not specified")).toBeNull();
  });

  it("REJECTS 'competitive' alone", () => {
    expect(parseSalaryRange("competitive")).toBeNull();
  });

  it("REJECTS 'market competitive' alone", () => {
    expect(parseSalaryRange("market competitive")).toBeNull();
  });

  it("ACCEPTS 'competitive base + $80k bonus' (digits present — Bug #10 fix)", () => {
    const r = parseSalaryRange("competitive base + $80k bonus");
    expect(r).not.toBeNull();
    expect(r!.min).toBe(80_000);
  });

  it("ACCEPTS 'Negotiable up to 150k'", () => {
    const r = parseSalaryRange("Negotiable up to 150k");
    expect(r).not.toBeNull();
  });

  it("REJECTS empty string", () => {
    expect(parseSalaryRange("")).toBeNull();
  });

  it("REJECTS string with no digits at all", () => {
    expect(parseSalaryRange("DOE — depends on experience")).toBeNull();
  });

  it("M suffix multiplies by 1,000,000", () => {
    const r = parseSalaryRange("$1m base");
    expect(r!.min).toBe(1_000_000);
  });

  it("min and max are correctly ordered (smaller is min)", () => {
    const r = parseSalaryRange("$120k-$80k");
    expect(r!.min).toBeLessThanOrEqual(r!.max);
  });

  it("commas in numbers are stripped", () => {
    const r = parseSalaryRange("80,000-120,000");
    expect(r!.min).toBe(80_000);
    expect(r!.max).toBe(120_000);
  });

  it("integer rounding applied", () => {
    const r = parseSalaryRange("$80,500");
    expect(Number.isInteger(r!.min)).toBe(true);
    expect(Number.isInteger(r!.max)).toBe(true);
  });
});

describe("keywordMatchesText", () => {
  it("matches exact whole word", () => {
    expect(keywordMatchesText("react", "looking for a react developer")).toBe(true);
  });

  it("does not match a substring of a different word", () => {
    expect(keywordMatchesText("react", "reactor maintenance team")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(keywordMatchesText("REACT", "we use React Native")).toBe(true);
  });

  it("matches via COMPOUND_VARIANTS (postgres -> postgresql)", () => {
    expect(keywordMatchesText("postgresql", "experience with postgres")).toBe(true);
  });

  it("matches node.js variants", () => {
    expect(keywordMatchesText("nodejs", "Node.js backend")).toBe(true);
    expect(keywordMatchesText("node.js", "nodejs runtime")).toBe(true);
  });

  it("matches kubernetes via k8s alias", () => {
    expect(keywordMatchesText("kubernetes", "we deploy on k8s")).toBe(true);
  });

  it("returns false on empty keyword", () => {
    expect(keywordMatchesText("", "react developer")).toBe(false);
  });

  it("returns false on empty text", () => {
    expect(keywordMatchesText("react", "")).toBe(false);
  });
});

describe("normalizeText", () => {
  it("lowercases input", () => {
    expect(normalizeText("HELLO World")).toContain("hello world");
  });

  it("returns lowercased string with content preserved", () => {
    expect(normalizeText("A    b\n\nC")).toContain("a");
    expect(normalizeText("A    b\n\nC")).toContain("c");
  });

  it("returns string for non-empty input", () => {
    expect(typeof normalizeText("anything")).toBe("string");
  });
});

describe("expandStackAcronyms", () => {
  it("returns array (never null)", () => {
    const out = expandStackAcronyms("MERN stack");
    expect(Array.isArray(out)).toBe(true);
  });

  it("expands MERN to constituent technologies", () => {
    const out = expandStackAcronyms("MERN stack").map((s) => s.toLowerCase());
    // Should include react/express/node/mongo somewhere
    expect(
      out.some((s) => s.includes("react") || s.includes("node") || s.includes("mongo") || s.includes("express")),
    ).toBe(true);
  });

  it("returns [] for text with no recognized acronyms", () => {
    const out = expandStackAcronyms("just some random text");
    expect(out.length).toBe(0);
  });
});
