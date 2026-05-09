import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { systemLog: { create: vi.fn().mockResolvedValue({}) } },
}));

import { verifyCronSecret, unauthorizedResponse } from "./cron-auth";

function makeReq(opts: {
  authHeader?: string;
  customHeader?: string;
  queryParam?: string;
  pathname?: string;
}): NextRequest {
  const url = new URL(`https://example.com${opts.pathname ?? "/api/cron/test"}`);
  if (opts.queryParam) url.searchParams.set("secret", opts.queryParam);
  const headers = new Headers();
  if (opts.authHeader) headers.set("authorization", opts.authHeader);
  if (opts.customHeader) headers.set("x-cron-secret", opts.customHeader);
  return new NextRequest(url, { headers });
}

describe("verifyCronSecret", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "expected-secret";
  });

  it("rejects when CRON_SECRET env var is unset", () => {
    delete process.env.CRON_SECRET;
    const req = makeReq({ authHeader: "Bearer anything" });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("rejects when no secret provided in any form", () => {
    expect(verifyCronSecret(makeReq({}))).toBe(false);
  });

  it("accepts correct Bearer token", () => {
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer expected-secret" }))).toBe(true);
  });

  it("rejects incorrect Bearer token", () => {
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer wrong-secret" }))).toBe(false);
  });

  it("accepts x-cron-secret custom header", () => {
    expect(verifyCronSecret(makeReq({ customHeader: "expected-secret" }))).toBe(true);
  });

  it("rejects wrong x-cron-secret value", () => {
    expect(verifyCronSecret(makeReq({ customHeader: "wrong" }))).toBe(false);
  });

  it("accepts secret via ?secret= query param", () => {
    expect(verifyCronSecret(makeReq({ queryParam: "expected-secret" }))).toBe(true);
  });

  it("rejects wrong query-param secret", () => {
    expect(verifyCronSecret(makeReq({ queryParam: "wrong" }))).toBe(false);
  });

  it("Authorization header takes precedence over query param", () => {
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer expected-secret", queryParam: "wrong" }))).toBe(true);
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer wrong", queryParam: "expected-secret" }))).toBe(false);
  });

  it("rejects secret of different length even if it 'starts with' correct value", () => {
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer expected-secretX" }))).toBe(false);
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer expected-secre" }))).toBe(false);
  });

  it("uses timing-safe comparison (not string equality)", () => {
    // We can't observe timing directly, but verify that a secret of equal length
    // but different content still rejects (covers timing-safe path)
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer xxxxxxxxxxxxxxx" }))).toBe(false);
  });

  it("does NOT accept 'Bearer undefined' literal when env var is unset", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer undefined" }))).toBe(false);
  });

  it("rejects empty Bearer payload", () => {
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer " }))).toBe(false);
  });

  it("strips 'Bearer ' prefix correctly", () => {
    // The implementation does .replace("Bearer ", "") — assert correct behavior
    expect(verifyCronSecret(makeReq({ authHeader: "Bearer expected-secret" }))).toBe(true);
  });
});

describe("unauthorizedResponse", () => {
  it("returns NextResponse with 401 status", () => {
    const r = unauthorizedResponse();
    expect(r.status).toBe(401);
  });

  it("body contains error key", async () => {
    const r = unauthorizedResponse();
    const body = await r.json();
    expect(body.error).toBeTruthy();
  });
});
