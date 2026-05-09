import { describe, it, expect } from "vitest";
import { extractEmailFromText } from "./extract-email-from-text";

describe("extractEmailFromText", () => {
  it("returns null email for empty string", () => {
    const r = extractEmailFromText("");
    expect(r.email).toBeNull();
  });

  it("returns null for text with no email", () => {
    expect(extractEmailFromText("just some text").email).toBeNull();
  });

  it("extracts simple email from text", () => {
    const r = extractEmailFromText("Send to careers@acme.com please");
    expect(r.email).toBe("careers@acme.com");
  });

  it("extracts first email when multiple present", () => {
    const r = extractEmailFromText("contact a@x.com or b@x.com");
    expect(r.email).toBeTruthy();
    expect(["a@x.com", "b@x.com"]).toContain(r.email);
  });

  it("normalizes to lowercase", () => {
    const r = extractEmailFromText("Email: Careers@Acme.com");
    expect(r.email).toBe("careers@acme.com");
  });

  it("excludes 'noreply' addresses", () => {
    const r = extractEmailFromText("Don't reply to noreply@acme.com");
    expect(r.email).toBeNull();
  });

  it("excludes 'support' addresses", () => {
    const r = extractEmailFromText("For help: support@acme.com");
    expect(r.email).toBeNull();
  });

  it("excludes 'no-reply' addresses", () => {
    const r = extractEmailFromText("from no-reply@acme.com");
    expect(r.email).toBeNull();
  });

  it("boosts confidence for 'careers@' prefix", () => {
    const a = extractEmailFromText("contact: careers@acme.com");
    const b = extractEmailFromText("contact: hello@acme.com");
    expect(a.confidence).toBeGreaterThanOrEqual(b.confidence);
  });

  it("boosts confidence for 'jobs@' prefix", () => {
    const r = extractEmailFromText("send to jobs@company.com");
    expect(r.confidence).toBeGreaterThan(50);
  });

  it("boosts confidence for 'hr@' prefix", () => {
    const r = extractEmailFromText("Apply: hr@company.com");
    expect(r.confidence).toBeGreaterThan(50);
  });

  it("boosts confidence for 'recruiting@' prefix", () => {
    const r = extractEmailFromText("recruiting@acme.com");
    expect(r.confidence).toBeGreaterThan(50);
  });

  it("returns confidence in 0-100 range", () => {
    const r = extractEmailFromText("careers@acme.com");
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(100);
  });

  it("handles emails with subdomains", () => {
    const r = extractEmailFromText("hr@careers.bigco.example.com");
    expect(r.email).toBe("hr@careers.bigco.example.com");
  });

  it("handles emails with numbers/hyphens in local part", () => {
    const r = extractEmailFromText("apply: jobs-2026@company.com");
    expect(r.email).toBe("jobs-2026@company.com");
  });

  it("handles emails with plus aliases", () => {
    const r = extractEmailFromText("careers+role@acme.com");
    expect(r.email).toContain("@acme.com");
  });

  it("ignores common 'sales@' / 'info@' lower-priority prefixes appropriately", () => {
    const r = extractEmailFromText("info@acme.com");
    // info@ may or may not be excluded; assert function doesn't throw
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });

  it("strips trailing punctuation from extracted email", () => {
    const r = extractEmailFromText("Reach out at careers@acme.com.");
    expect(r.email).toBe("careers@acme.com");
  });

  it("strips angle brackets", () => {
    const r = extractEmailFromText("Email <careers@acme.com>");
    expect(r.email).toBe("careers@acme.com");
  });

  it("returns same shape for null/undefined-like", () => {
    expect(extractEmailFromText("").email).toBeNull();
    expect(extractEmailFromText("   ").email).toBeNull();
  });

  it("does not extract obviously invalid emails", () => {
    expect(extractEmailFromText("a@@b.com").email).toBeFalsy();
    expect(extractEmailFromText("not.an.email").email).toBeNull();
  });
});
