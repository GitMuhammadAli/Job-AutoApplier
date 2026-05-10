import { describe, it, expect } from "vitest";
import { classifyError, isAddressNotFound } from "./email-errors";

describe("classifyError — auth errors (not retryable)", () => {
  it("classifies SMTP 535 as auth", () => {
    const e = { message: "auth failed", responseCode: 535 };
    const r = classifyError(e);
    expect(r.type).toBe("auth");
    expect(r.retryable).toBe(false);
    expect(r.code).toBe("535");
  });

  it("classifies SMTP 534 as auth", () => {
    const e = { message: "auth required", responseCode: 534 };
    expect(classifyError(e).type).toBe("auth");
  });

  it("classifies 'authentication failed' message as auth", () => {
    expect(classifyError(new Error("authentication failed")).type).toBe("auth");
  });

  it("classifies 'invalid login' message as auth", () => {
    expect(classifyError(new Error("invalid login")).type).toBe("auth");
  });

  it("auth errors are NOT retryable", () => {
    expect(classifyError(new Error("authentication failed")).retryable).toBe(false);
  });
});

describe("classifyError — rate limit (retryable)", () => {
  it("classifies 'rate limit exceeded' as rate_limit", () => {
    const r = classifyError(new Error("rate limit exceeded"));
    expect(r.type).toBe("rate_limit");
    expect(r.retryable).toBe(true);
  });

  it("classifies 'too many messages' as rate_limit", () => {
    expect(classifyError(new Error("too many messages")).type).toBe("rate_limit");
  });

  it("classifies 'quota exceeded' as rate_limit", () => {
    expect(classifyError(new Error("quota exceeded")).type).toBe("rate_limit");
  });
});

describe("classifyError — permanent failures (not retryable)", () => {
  it("classifies SMTP 550 by responseCode", () => {
    const e = { message: "user unknown", responseCode: 550 };
    expect(classifyError(e).type).toBe("permanent");
    expect(classifyError(e).retryable).toBe(false);
    expect(classifyError(e).code).toBe("550");
  });

  it("classifies SMTP 553 as permanent", () => {
    const e = { message: "bad recipient", responseCode: 553 };
    expect(classifyError(e).type).toBe("permanent");
  });

  it("classifies 'mailbox not found' as permanent", () => {
    expect(classifyError(new Error("mailbox not found")).type).toBe("permanent");
  });

  it("classifies 'no such user' as permanent", () => {
    expect(classifyError(new Error("no such user here")).type).toBe("permanent");
  });

  it("matches permanent code by word boundary in message", () => {
    expect(classifyError(new Error("error: 550 user unknown")).type).toBe("permanent");
  });

  it("does NOT match 550 inside another number (boundary check)", () => {
    // "5500" has no \b550\b boundary, so it shouldn't match
    const r = classifyError(new Error("server reports 5500 things"));
    expect(r.type).not.toBe("permanent");
  });
});

describe("classifyError — network (retryable)", () => {
  it("classifies 'connection refused' as network", () => {
    expect(classifyError(new Error("connection refused")).type).toBe("network");
  });

  it("classifies 'ECONNRESET' as network", () => {
    expect(classifyError(new Error("ECONNRESET on socket")).type).toBe("network");
  });

  it("classifies 'ETIMEDOUT' as network", () => {
    expect(classifyError(new Error("ETIMEDOUT after 30s")).type).toBe("network");
  });

  it("network errors are retryable", () => {
    expect(classifyError(new Error("connection refused")).retryable).toBe(true);
  });
});

describe("classifyError — transient SMTP 4xx (retryable)", () => {
  it("classifies SMTP 421 by responseCode", () => {
    const e = { message: "service not available", responseCode: 421 };
    const r = classifyError(e);
    expect(r.type).toBe("transient");
    expect(r.retryable).toBe(true);
  });

  it("classifies '4xx' code in message via regex", () => {
    expect(classifyError(new Error("got 451 try later")).type).toBe("transient");
  });

  it("transient errors are retryable", () => {
    expect(classifyError(new Error("got 451 try later")).retryable).toBe(true);
  });
});

describe("classifyError — fallback (transient default)", () => {
  it("unknown error -> transient retryable", () => {
    const r = classifyError(new Error("something weird happened"));
    expect(r.type).toBe("transient");
    expect(r.retryable).toBe(true);
  });

  it("plain string error works", () => {
    expect(classifyError("connection refused").type).toBe("network");
  });

  it("non-error object with message works", () => {
    expect(classifyError({ message: "auth failed" }).type).toBe("auth");
  });

  it("null error doesn't crash", () => {
    expect(() => classifyError(null)).not.toThrow();
  });

  it("undefined error doesn't crash", () => {
    expect(() => classifyError(undefined)).not.toThrow();
  });
});

describe("classifyError — preserves raw message", () => {
  it("preserves the original error message", () => {
    const r = classifyError(new Error("Auth failed: invalid login"));
    expect(r.message).toBe("Auth failed: invalid login");
  });
});

describe("isAddressNotFound", () => {
  it("returns true for 'no such user' phrase", () => {
    expect(isAddressNotFound(new Error("no such user"))).toBe(true);
  });

  it("returns true for 'mailbox not found'", () => {
    expect(isAddressNotFound(new Error("mailbox not found"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isAddressNotFound(new Error("connection refused"))).toBe(false);
  });

  it("returns false for empty message", () => {
    expect(isAddressNotFound(new Error(""))).toBe(false);
  });

  it("handles non-Error values", () => {
    expect(isAddressNotFound("no such user")).toBe(true);
    expect(isAddressNotFound("happy email")).toBe(false);
  });

  it("does not throw on null/undefined", () => {
    expect(() => isAddressNotFound(null)).not.toThrow();
    expect(() => isAddressNotFound(undefined)).not.toThrow();
  });
});
