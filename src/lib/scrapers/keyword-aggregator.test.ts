import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userSettings: { findMany: vi.fn() },
    jobApplication: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { aggregateSearchQueries } from "./keyword-aggregator";

const findManySettings = vi.mocked(prisma.userSettings.findMany);
const findManyApps = vi.mocked(prisma.jobApplication.findMany);

describe("aggregateSearchQueries — Bug #11 regression: only counts onboarded users", () => {
  beforeEach(() => {
    findManySettings.mockReset();
    findManyApps.mockReset();
    findManyApps.mockResolvedValue([] as never);
  });

  it("filters by isOnboarded=true (Bug #11 fix)", async () => {
    findManySettings.mockResolvedValue([] as never);
    await aggregateSearchQueries();

    const args = findManySettings.mock.calls[0]?.[0];
    expect(args?.where).toMatchObject({ isOnboarded: true });
  });

  it("filters by accountStatus='active'", async () => {
    findManySettings.mockResolvedValue([] as never);
    await aggregateSearchQueries();

    const args = findManySettings.mock.calls[0]?.[0];
    expect(args?.where).toMatchObject({ accountStatus: "active" });
  });

  it("filters by keywords not empty", async () => {
    findManySettings.mockResolvedValue([] as never);
    await aggregateSearchQueries();

    const args = findManySettings.mock.calls[0]?.[0];
    expect(args?.where?.keywords).toMatchObject({ isEmpty: false });
  });

  it("returns empty array when no users match the filter", async () => {
    findManySettings.mockResolvedValue([] as never);
    const out = await aggregateSearchQueries();
    expect(out).toEqual([]);
  });

  it("aggregates keywords across users", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["react", "node"], city: "Lahore", country: "Pakistan" },
      { keywords: ["react", "python"], city: "Karachi", country: "Pakistan" },
    ] as never);

    const out = await aggregateSearchQueries();
    const keywords = out.map((q) => q.keyword).sort();
    expect(keywords).toContain("react");
    expect(keywords).toContain("node");
    expect(keywords).toContain("python");
  });

  it("normalizes keywords (lowercase + trim)", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["  React ", "REACT", "node"], city: null, country: null },
    ] as never);

    const out = await aggregateSearchQueries();
    const keywords = out.map((q) => q.keyword);
    expect(keywords).toContain("react"); // dedup'd to one
    expect(keywords.filter((k) => k === "react").length).toBe(1);
  });

  it("always includes 'Remote' in cities for every keyword", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["react"], city: "Lahore", country: "Pakistan" },
    ] as never);

    const out = await aggregateSearchQueries();
    expect(out[0].cities).toContain("Remote");
  });

  it("includes user's city and country in cities", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["react"], city: "Lahore", country: "Pakistan" },
    ] as never);

    const out = await aggregateSearchQueries();
    expect(out[0].cities).toContain("Lahore");
    expect(out[0].cities).toContain("Pakistan");
  });

  it("merges cities from multiple users for the same keyword", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["react"], city: "Lahore", country: null },
      { keywords: ["react"], city: "Karachi", country: null },
    ] as never);

    const out = await aggregateSearchQueries();
    const reactQuery = out.find((q) => q.keyword === "react")!;
    expect(reactQuery.cities).toContain("Lahore");
    expect(reactQuery.cities).toContain("Karachi");
  });

  it("filters out keywords shorter than 2 chars", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["a", "ab", "react"], city: null, country: null },
    ] as never);

    const out = await aggregateSearchQueries();
    const keywords = out.map((q) => q.keyword);
    expect(keywords).not.toContain("a");
    expect(keywords).toContain("ab");
    expect(keywords).toContain("react");
  });

  it("strips noise punctuation but preserves dot/hash/plus/slash/dash", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["c++", "node.js", "ci/cd", "front-end"], city: null, country: null },
    ] as never);

    const out = await aggregateSearchQueries();
    const keywords = out.map((q) => q.keyword);
    expect(keywords).toContain("c++");
    expect(keywords).toContain("node.js");
    expect(keywords).toContain("ci/cd");
    expect(keywords).toContain("front-end");
  });

  it("'paid' mode limits to top 5 keywords by ROI score", async () => {
    findManySettings.mockResolvedValue([
      { keywords: ["a1", "a2", "a3", "a4", "a5", "a6", "a7"], city: null, country: null },
    ] as never);

    const out = await aggregateSearchQueries("paid");
    expect(out.length).toBeLessThanOrEqual(5);
  });
});
