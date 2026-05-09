import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchRemotive } from "./remotive";

vi.mock("./fetch-with-retry", () => ({
  fetchWithRetry: vi.fn(),
}));

import { fetchWithRetry } from "./fetch-with-retry";
const mockedFetch = vi.mocked(fetchWithRetry);

function mockResponse(jobs: unknown[]) {
  return { ok: true, json: async () => ({ jobs }) } as unknown as Response;
}
const fresh = () => new Date().toISOString();
const stale = () => new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

describe("fetchRemotive — Bug #4 regression: per-keyword search", () => {
  beforeEach(() => mockedFetch.mockReset());

  it("uses ?search= per keyword (not the global feed)", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    await fetchRemotive([
      { keyword: "react", cities: [] },
      { keyword: "node", cities: [] },
    ]);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("search=react"))).toBe(true);
    expect(urls.some((u) => u.includes("search=node"))).toBe(true);
  });

  it("URL-encodes special characters in the keyword", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    await fetchRemotive([{ keyword: "node.js", cities: [] }]);
    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("search=node.js"))).toBe(true);
  });

  it("caps keyword count to 5 per run", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    const queries = Array.from({ length: 8 }, (_, i) => ({ keyword: `kw${i}`, cities: [] }));
    await fetchRemotive(queries);

    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.length).toBeLessThanOrEqual(5);
  });

  it("falls back to global feed when no keywords supplied", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    await fetchRemotive([]);
    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.length).toBe(1);
    expect(urls[0]).not.toContain("search=");
  });

  it("dedupes keywords case-insensitively", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    await fetchRemotive([
      { keyword: "React", cities: [] },
      { keyword: "REACT", cities: [] },
    ]);
    expect(mockedFetch.mock.calls.length).toBe(1);
  });

  it("dedupes results with the same id across calls", async () => {
    const job = { id: 1, title: "Dev", company_name: "co", url: "u", publication_date: fresh() };
    mockedFetch.mockResolvedValue(mockResponse([job, job]));
    const out = await fetchRemotive([{ keyword: "react", cities: [] }]);
    const ids = out.map((j) => j.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters out jobs older than 3 days", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([
        { id: 1, title: "old", company_name: "co", publication_date: stale() },
        { id: 2, title: "new", company_name: "co", publication_date: fresh() },
      ]),
    );
    const out = await fetchRemotive([{ keyword: "react", cities: [] }]);
    const titles = out.map((j) => j.title);
    expect(titles).toContain("new");
    expect(titles).not.toContain("old");
  });

  it("strips HTML from description", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([
        { id: 1, title: "T", company_name: "co", description: "<p>hello <b>world</b></p>", publication_date: fresh() },
      ]),
    );
    const out = await fetchRemotive([{ keyword: "react", cities: [] }]);
    expect(out[0].description).toBe("hello world");
  });

  it("sets source='remotive' and stable sourceId", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([{ id: 42, title: "T", company_name: "co", publication_date: fresh() }]),
    );
    const out = await fetchRemotive([{ keyword: "react", cities: [] }]);
    expect(out[0].source).toBe("remotive");
    expect(out[0].sourceId).toBe("remotive-42");
  });

  it("location defaults to 'Remote' when API doesn't supply one", async () => {
    mockedFetch.mockResolvedValue(
      mockResponse([{ id: 1, title: "T", company_name: "co", publication_date: fresh() }]),
    );
    const out = await fetchRemotive([{ keyword: "react", cities: [] }]);
    expect(out[0].location).toBe("Remote");
  });

  it("survives non-ok response", async () => {
    mockedFetch.mockResolvedValue({ ok: false, json: async () => ({ jobs: [] }) } as unknown as Response);
    await expect(fetchRemotive([{ keyword: "react", cities: [] }])).resolves.toEqual([]);
  });

  it("survives JSON parse error from API", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("parse error");
      },
    } as unknown as Response);
    await expect(fetchRemotive([{ keyword: "react", cities: [] }])).resolves.toEqual([]);
  });

  it("trims keyword whitespace before using as search term", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    await fetchRemotive([{ keyword: "  react  ", cities: [] }]);
    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => /search=react(?!%20)/.test(u))).toBe(true);
  });

  it("applies limit=100 per call", async () => {
    mockedFetch.mockResolvedValue(mockResponse([]));
    await fetchRemotive([{ keyword: "react", cities: [] }]);
    const urls = mockedFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.every((u) => u.includes("limit=100"))).toBe(true);
  });
});
