import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset state for known actions/users used in tests
    for (const u of ["u1", "u2", "u3", "u4", "u5"]) {
      for (const a of ["ai-generate", "scan-now", "send-email", "application-generate", "cover-letter", "default", "unknown-action"]) {
        resetRateLimit(u, a);
      }
    }
  });

  it("first call is allowed", () => {
    const r = checkRateLimit("u1", "ai-generate");
    expect(r.allowed).toBe(true);
  });

  it("returns remaining count for first call", () => {
    const r = checkRateLimit("u1", "ai-generate");
    expect(r.remaining).toBe(4); // ai-generate has max=5, 1 used
  });

  it("blocks once limit hit", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    const blocked = checkRateLimit("u1", "ai-generate");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns retryAfterMs when blocked", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    const r = checkRateLimit("u1", "ai-generate");
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("retryAfterMs is at least 1000ms when blocked", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    const r = checkRateLimit("u1", "ai-generate");
    expect(r.retryAfterMs!).toBeGreaterThanOrEqual(1000);
  });

  it("isolates limits per user", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    expect(checkRateLimit("u2", "ai-generate").allowed).toBe(true);
  });

  it("isolates limits per action", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    expect(checkRateLimit("u1", "send-email").allowed).toBe(true);
  });

  it("scan-now allows only 1 per 5 minutes", () => {
    expect(checkRateLimit("u3", "scan-now").allowed).toBe(true);
    expect(checkRateLimit("u3", "scan-now").allowed).toBe(false);
  });

  it("send-email allows up to 10/min", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("u4", "send-email").allowed).toBe(true);
    }
    expect(checkRateLimit("u4", "send-email").allowed).toBe(false);
  });

  it("unknown action falls back to default config (30/min)", () => {
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("u5", "unknown-action").allowed).toBe(true);
    }
    expect(checkRateLimit("u5", "unknown-action").allowed).toBe(false);
  });

  it("remaining count decreases monotonically within window", () => {
    const r1 = checkRateLimit("u1", "send-email");
    const r2 = checkRateLimit("u1", "send-email");
    const r3 = checkRateLimit("u1", "send-email");
    expect(r1.remaining).toBeGreaterThan(r2.remaining);
    expect(r2.remaining).toBeGreaterThan(r3.remaining);
  });
});

describe("resetRateLimit", () => {
  it("clears the user's count for an action", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    expect(checkRateLimit("u1", "ai-generate").allowed).toBe(false);

    resetRateLimit("u1", "ai-generate");
    expect(checkRateLimit("u1", "ai-generate").allowed).toBe(true);
  });

  it("does not clear other users", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    for (let i = 0; i < 5; i++) checkRateLimit("u2", "ai-generate");

    resetRateLimit("u1", "ai-generate");
    expect(checkRateLimit("u1", "ai-generate").allowed).toBe(true);
    expect(checkRateLimit("u2", "ai-generate").allowed).toBe(false);
  });

  it("does not clear other actions", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "ai-generate");
    for (let i = 0; i < 5; i++) checkRateLimit("u1", "application-generate");

    resetRateLimit("u1", "ai-generate");
    expect(checkRateLimit("u1", "ai-generate").allowed).toBe(true);
    expect(checkRateLimit("u1", "application-generate").allowed).toBe(false);
  });

  it("is a no-op when no entry exists", () => {
    expect(() => resetRateLimit("nonexistent", "ai-generate")).not.toThrow();
  });
});
