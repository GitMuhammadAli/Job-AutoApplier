import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchArbeitnow } from "./arbeitnow";

// Mock fetchWithRetry so we don't hit the real API
vi.mock("./fetch-with-retry", () => ({
  fetchWithRetry: vi.fn(),
}));

import { fetchWithRetry } from "./fetch-with-retry";
const mockedFetch = vi.mocked(fetchWithRetry);

function mockResponse(jobs: unknown[]) {
  return {
    ok: true,
    json: async () => ({ data: jobs }),
  } as unknown as Response;
}
function emptyResponse() {
  return mockResponse([]);
}

describe("fetchArbeitnow — Bug #4 regression: uses keyword search", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("hits the search endpoint per keyword (not the global feed)", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());

    await fetchArbeitnow([
      { keyword: "react", cities: ["Remote"] },
      { keyword: "node", cities: ["Remote"] },
    ]);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    // At least one fetch URL must include search=react
    expect(urls.some((u) => u.includes("search=react"))).toBe(true);
    expect(urls.some((u) => u.includes("search=node"))).toBe(true);
  });

  it("encodes keywords with special characters", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());
    await fetchArbeitnow([{ keyword: "c#", cities: [] }]);
    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("search=c%23"))).toBe(true);
  });

  it("caps keyword count to MAX_KEYWORDS_PER_RUN (5)", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());

    const queries = Array.from({ length: 10 }, (_, i) => ({
      keyword: `keyword${i}`,
      cities: [],
    }));
    await fetchArbeitnow(queries);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    const uniqueSearchTerms = new Set(
      urls
        .map((u) => {
          const m = u.match(/search=([^&]+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean),
    );
    expect(uniqueSearchTerms.size).toBeLessThanOrEqual(5);
  });

  it("fetches up to 2 pages per keyword", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());
    await fetchArbeitnow([{ keyword: "react", cities: [] }]);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    const reactPages = urls.filter((u) => u.includes("search=react"));
    expect(reactPages.length).toBeLessThanOrEqual(2);
  });

  it("falls back to global feed when no keywords supplied", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());
    await fetchArbeitnow([]);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    // No `search=` param when no keywords
    expect(urls.every((u) => !u.includes("search="))).toBe(true);
    expect(urls.length).toBeGreaterThan(0); // still fetches
  });

  it("returns empty array gracefully when API returns 0 jobs", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());
    const result = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    expect(result).toEqual([]);
  });

  it("dedupes jobs with the same slug across pages/keywords", async () => {
    const jobA = {
      slug: "abc-123",
      title: "Senior React",
      company_name: "Acme",
      remote: true,
      created_at: Math.floor(Date.now() / 1000),
    };
    mockedFetch.mockResolvedValue(mockResponse([jobA, jobA, jobA]));

    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    const ids = out.map((j) => j.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters out jobs older than 3 days", async () => {
    const fourDaysAgo = Math.floor((Date.now() - 4 * 24 * 60 * 60 * 1000) / 1000);
    const yesterday = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

    mockedFetch.mockResolvedValue(
      mockResponse([
        { slug: "a", title: "old", company_name: "co", created_at: fourDaysAgo },
        { slug: "b", title: "fresh", company_name: "co", created_at: yesterday },
      ]),
    );

    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    const titles = out.map((j) => j.title);
    expect(titles).toContain("fresh");
    expect(titles).not.toContain("old");
  });

  it("preserves jobs without postedDate (treated as fresh)", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([{ slug: "x", title: "no-date", company_name: "co" }]),
    );

    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    expect(out.map((j) => j.title)).toContain("no-date");
  });

  it("maps remote=true to jobType='remote'", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([
        {
          slug: "x",
          title: "Remote Dev",
          company_name: "co",
          remote: true,
          created_at: Math.floor(Date.now() / 1000),
        },
      ]),
    );

    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    expect(out[0].jobType).toBe("remote");
  });

  it("sets source field to 'arbeitnow'", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([{ slug: "x", title: "X", company_name: "co", created_at: Math.floor(Date.now() / 1000) }]),
    );
    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    expect(out[0].source).toBe("arbeitnow");
  });

  it("survives non-ok responses without throwing", async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ data: [] }),
    } as unknown as Response);

    await expect(fetchArbeitnow([{ keyword: "react", cities: [] }])).resolves.toEqual([]);
  });

  it("survives JSON parse errors without throwing", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as Response);

    await expect(fetchArbeitnow([{ keyword: "react", cities: [] }])).resolves.toEqual([]);
  });

  it("dedupes keywords case-insensitively", async () => {
    mockedFetch.mockResolvedValue(emptyResponse());

    await fetchArbeitnow([
      { keyword: "React", cities: [] },
      { keyword: "REACT", cities: [] },
      { keyword: "react", cities: [] },
    ]);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    const reactCalls = urls.filter((u) => u.toLowerCase().includes("search=react"));
    // 1 unique keyword × up to 2 pages = at most 2 calls
    expect(reactCalls.length).toBeLessThanOrEqual(2);
  });

  it("sets stable sourceId from slug", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([{ slug: "abc-xyz", title: "T", company_name: "co", created_at: Math.floor(Date.now() / 1000) }]),
    );
    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    expect(out[0].sourceId).toBe("arbeitnow-abc-xyz");
  });

  it("falls back to slug-from-title when slug missing", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([{ title: "Backend Engineer", company_name: "Acme", created_at: Math.floor(Date.now() / 1000) }]),
    );
    const out = await fetchArbeitnow([{ keyword: "react", cities: [] }]);
    expect(out[0].sourceId).toMatch(/^arbeitnow-/);
  });
});
