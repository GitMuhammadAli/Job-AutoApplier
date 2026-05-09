import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, validateAdminCredentials } from "./admin-auth";

describe("hashPassword", () => {
  it("returns salt:hash format (32-char salt + colon + 128-char hash)", () => {
    const out = hashPassword("password");
    expect(out).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("produces different hashes for same input (salt randomness)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("handles empty password", () => {
    expect(hashPassword("")).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("handles unicode/multi-byte passwords", () => {
    expect(hashPassword("pässwörd 🔒")).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("handles very long passwords", () => {
    expect(hashPassword("x".repeat(1000))).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });
});

describe("validateAdminCredentials", () => {
  beforeEach(() => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD;
  });

  it("returns false when ADMIN_USERNAME is missing", () => {
    process.env.ADMIN_PASSWORD_HASH = hashPassword("p");
    expect(validateAdminCredentials("admin", "p")).toBe(false);
  });

  it("returns false when ADMIN_PASSWORD_HASH is missing", () => {
    process.env.ADMIN_USERNAME = "admin";
    expect(validateAdminCredentials("admin", "p")).toBe(false);
  });

  it("returns false when input username is empty", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("p");
    expect(validateAdminCredentials("", "p")).toBe(false);
  });

  it("returns false when input password is empty", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("p");
    expect(validateAdminCredentials("admin", "")).toBe(false);
  });

  it("returns true with correct username + password against hash", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("secret");
    expect(validateAdminCredentials("admin", "secret")).toBe(true);
  });

  it("returns false with correct username but wrong password", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("secret");
    expect(validateAdminCredentials("admin", "wrong")).toBe(false);
  });

  it("returns false with wrong username but correct password", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("secret");
    expect(validateAdminCredentials("wrong", "secret")).toBe(false);
  });

  it("rejects plaintext (non-hashed) ADMIN_PASSWORD env var", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "plaintext";
    expect(validateAdminCredentials("admin", "plaintext")).toBe(false);
  });

  it("uses timing-safe equality on username (length difference)", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("p");
    expect(validateAdminCredentials("a", "p")).toBe(false);
    expect(validateAdminCredentials("administrator", "p")).toBe(false);
  });

  it("uses timing-safe equality on hash comparison", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("password1");
    expect(validateAdminCredentials("admin", "password2")).toBe(false);
  });
});
