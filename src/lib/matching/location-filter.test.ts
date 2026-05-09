import { describe, it, expect } from "vitest";
import {
  jobMatchesPlatformPreferences,
  jobMatchesLocationPreferences,
  buildExistingJobKeys,
  isDuplicateByKey,
  deduplicateUserJobsByLogicalJob,
} from "./location-filter";

describe("jobMatchesPlatformPreferences", () => {
  it("returns true when no platform preferences set (matches all)", () => {
    expect(jobMatchesPlatformPreferences("linkedin", null)).toBe(true);
    expect(jobMatchesPlatformPreferences("linkedin", [])).toBe(true);
  });

  it("returns true when source is in user's preferred platforms", () => {
    expect(jobMatchesPlatformPreferences("linkedin", ["linkedin", "indeed"])).toBe(true);
  });

  it("returns false when source not in user's preferred platforms", () => {
    expect(jobMatchesPlatformPreferences("rozee", ["linkedin", "indeed"])).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(jobMatchesPlatformPreferences("LINKEDIN", ["linkedin"])).toBe(true);
    expect(jobMatchesPlatformPreferences("linkedin", ["LINKEDIN"])).toBe(true);
  });

  it("trims whitespace from preference entries", () => {
    expect(jobMatchesPlatformPreferences("linkedin", ["  linkedin  "])).toBe(true);
  });

  it("returns true when source is null/empty (no negative match — handled at upper layer)", () => {
    expect(jobMatchesPlatformPreferences(null, ["linkedin"])).toBe(true);
    expect(jobMatchesPlatformPreferences("", ["linkedin"])).toBe(true);
  });

  it("ignores empty preference entries", () => {
    expect(jobMatchesPlatformPreferences("linkedin", ["", "linkedin"])).toBe(true);
    // when only empty strings supplied -> no real preferences -> matches all
    expect(jobMatchesPlatformPreferences("any-source", ["", "  "])).toBe(true);
  });
});

describe("jobMatchesLocationPreferences", () => {
  it("returns true when no preferences set", () => {
    expect(jobMatchesLocationPreferences("New York", null, null, null, null)).toBe(true);
  });

  it("returns true for remote jobs regardless of city/country preferences", () => {
    expect(jobMatchesLocationPreferences("Remote - Anywhere", "Lahore", "Pakistan", null, null)).toBe(true);
    expect(jobMatchesLocationPreferences("100% Remote", "Lahore", "Pakistan", null, null)).toBe(true);
  });

  it("returns true when job city matches user city", () => {
    expect(jobMatchesLocationPreferences("Lahore, Pakistan", "Lahore", null, null, null)).toBe(true);
  });

  it("returns true when job country matches user country", () => {
    expect(jobMatchesLocationPreferences("Karachi, Pakistan", null, "Pakistan", null, null)).toBe(true);
  });

  it("returns false when job is in a different country with no remote keyword", () => {
    expect(jobMatchesLocationPreferences("Berlin, Germany", "Lahore", "Pakistan", null, null)).toBe(false);
  });

  it("returns true when null/empty location passes through (no negative match)", () => {
    expect(jobMatchesLocationPreferences(null, "Lahore", "Pakistan", null, null)).toBe(true);
    expect(jobMatchesLocationPreferences("", "Lahore", "Pakistan", null, null)).toBe(true);
  });
});

describe("buildExistingJobKeys + isDuplicateByKey", () => {
  it("normalizes title and company before keying", () => {
    const keys = buildExistingJobKeys([{ title: "Senior React Developer", company: "Acme Inc." }]);
    expect(isDuplicateByKey(keys, "senior react developer", "acme")).toBe(true);
  });

  it("strips company suffixes (LLC, Ltd, Corp, etc.)", () => {
    const keys = buildExistingJobKeys([{ title: "Dev", company: "Acme LLC" }]);
    expect(isDuplicateByKey(keys, "Dev", "Acme Ltd")).toBe(true);
    expect(isDuplicateByKey(keys, "Dev", "Acme Corp")).toBe(true);
    expect(isDuplicateByKey(keys, "Dev", "Acme Pvt")).toBe(true);
  });

  it("returns false for genuinely different jobs", () => {
    const keys = buildExistingJobKeys([{ title: "Senior React Developer", company: "Acme" }]);
    expect(isDuplicateByKey(keys, "Backend Engineer", "Acme")).toBe(false);
    expect(isDuplicateByKey(keys, "Senior React Developer", "DifferentCo")).toBe(false);
  });

  it("strips punctuation/whitespace", () => {
    const keys = buildExistingJobKeys([{ title: "Senior React Developer", company: "Acme, Inc." }]);
    expect(isDuplicateByKey(keys, "  Senior   React   Developer ", "Acme Inc")).toBe(true);
  });

  it("handles empty existing list", () => {
    const keys = buildExistingJobKeys([]);
    expect(isDuplicateByKey(keys, "anything", "anything")).toBe(false);
  });

  it("handles null/undefined title or company gracefully", () => {
    const keys = buildExistingJobKeys([{ title: null as unknown as string, company: "Acme" }]);
    expect(keys instanceof Set).toBe(true);
  });
});

describe("deduplicateUserJobsByLogicalJob", () => {
  type Row = { id: string; globalJob: { title: string; company: string } };
  it("dedupes jobs sharing the same normalized (title, company)", () => {
    const rows: Row[] = [
      { id: "1", globalJob: { title: "Senior React", company: "Acme Inc." } },
      { id: "2", globalJob: { title: "Senior React", company: "Acme LLC" } },
      { id: "3", globalJob: { title: "Backend Eng", company: "Other Co" } },
    ];
    const out = deduplicateUserJobsByLogicalJob(rows);
    expect(out.length).toBe(2);
  });

  it("preserves the FIRST occurrence of each logical job", () => {
    const rows: Row[] = [
      { id: "first", globalJob: { title: "Dev", company: "Acme" } },
      { id: "second", globalJob: { title: "Dev", company: "Acme" } },
    ];
    const out = deduplicateUserJobsByLogicalJob(rows);
    expect(out.map((r) => r.id)).toEqual(["first"]);
  });

  it("returns input as-is when no duplicates exist", () => {
    const rows: Row[] = [
      { id: "1", globalJob: { title: "A", company: "X" } },
      { id: "2", globalJob: { title: "B", company: "Y" } },
    ];
    const out = deduplicateUserJobsByLogicalJob(rows);
    expect(out.length).toBe(2);
  });

  it("handles empty input", () => {
    expect(deduplicateUserJobsByLogicalJob([])).toEqual([]);
  });
});
