import { describe, it, expect } from "vitest";
import { getConfidenceScore, type EmailConfidence } from "./email-extractor";

describe("getConfidenceScore", () => {
  it("HIGH returns 95", () => {
    expect(getConfidenceScore("HIGH")).toBe(95);
  });

  it("MEDIUM returns 60", () => {
    expect(getConfidenceScore("MEDIUM")).toBe(60);
  });

  it("LOW returns 20", () => {
    expect(getConfidenceScore("LOW")).toBe(20);
  });

  it("NONE returns 0", () => {
    expect(getConfidenceScore("NONE")).toBe(0);
  });

  it("returns 0 for unrecognized confidence", () => {
    expect(getConfidenceScore("UNKNOWN" as unknown as EmailConfidence)).toBe(0);
  });

  it("HIGH > MEDIUM > LOW > NONE (monotone ordering)", () => {
    const h = getConfidenceScore("HIGH");
    const m = getConfidenceScore("MEDIUM");
    const l = getConfidenceScore("LOW");
    const n = getConfidenceScore("NONE");
    expect(h).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(l);
    expect(l).toBeGreaterThan(n);
  });

  it("all scores are in 0-100 range", () => {
    const tests: EmailConfidence[] = ["HIGH", "MEDIUM", "LOW", "NONE"];
    for (const c of tests) {
      const score = getConfidenceScore(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("returns integer (not float)", () => {
    expect(Number.isInteger(getConfidenceScore("HIGH"))).toBe(true);
  });
});
