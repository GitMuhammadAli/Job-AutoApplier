import { describe, it, expect } from "vitest";
import { cn, daysAgo, STAGES, STAGE_CONFIG } from "./utils";

describe("cn — tailwind-merge wrapper", () => {
  it("joins class strings", () => {
    expect(cn("a", "b", "c")).toContain("a");
    expect(cn("a", "b", "c")).toContain("b");
    expect(cn("a", "b", "c")).toContain("c");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toContain("a");
    expect(cn("a", false, null, undefined, "b")).toContain("b");
  });

  it("respects conditional class objects", () => {
    expect(cn("a", { b: true, c: false })).toContain("a");
    expect(cn("a", { b: true, c: false })).toContain("b");
    expect(cn("a", { b: true, c: false })).not.toContain("c");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    const result = cn("p-2", "p-4");
    expect(result).toContain("p-4");
    expect(result).not.toContain("p-2");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("flattens arrays of classes", () => {
    expect(cn(["a", "b"], "c")).toContain("a");
    expect(cn(["a", "b"], "c")).toContain("b");
    expect(cn(["a", "b"], "c")).toContain("c");
  });
});

describe("daysAgo", () => {
  it("returns null for null input", () => {
    expect(daysAgo(null)).toBeNull();
  });

  it("returns 0 for today", () => {
    expect(daysAgo(new Date())).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(daysAgo(yesterday)).toBe(1);
  });

  it("returns 7 for one week ago", () => {
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(daysAgo(week)).toBe(7);
  });

  it("accepts Date object", () => {
    expect(typeof daysAgo(new Date())).toBe("number");
  });

  it("accepts ISO string", () => {
    expect(typeof daysAgo(new Date().toISOString())).toBe("number");
  });

  it("returns integer", () => {
    const halfDay = new Date(Date.now() - 12 * 60 * 60 * 1000);
    expect(Number.isInteger(daysAgo(halfDay))).toBe(true);
  });

  it("handles future date (negative)", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(daysAgo(future)).toBeLessThanOrEqual(0);
  });
});

describe("STAGES + STAGE_CONFIG", () => {
  it("STAGES is non-empty array", () => {
    expect(STAGES.length).toBeGreaterThan(0);
  });

  it("STAGES contains expected lifecycle stages", () => {
    expect(STAGES).toEqual(
      expect.arrayContaining(["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"]),
    );
  });

  it("STAGE_CONFIG has entry for every STAGES value", () => {
    for (const stage of STAGES) {
      expect(STAGE_CONFIG).toHaveProperty(stage);
    }
  });

  it("STAGE_CONFIG entries are non-null objects", () => {
    for (const stage of STAGES) {
      expect(STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG]).toBeTruthy();
    }
  });
});
