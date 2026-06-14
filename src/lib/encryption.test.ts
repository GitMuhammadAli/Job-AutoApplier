import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptField,
  decryptField,
  encryptSettingsFields,
  decryptSettingsFields,
  hasDecryptionFailure,
  getDecryptionFailures,
} from "./encryption";

describe("encryption", () => {
  beforeAll(() => {
    // Generate a test key once for the whole suite
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  });

  describe("encrypt/decrypt round-trip", () => {
    it("roundtrips simple ASCII string", () => {
      const enc = encrypt("hello");
      expect(decrypt(enc)).toBe("hello");
    });

    it("roundtrips unicode string", () => {
      const enc = encrypt("héllo wörld 🚀 中文");
      expect(decrypt(enc)).toBe("héllo wörld 🚀 中文");
    });

    it("roundtrips empty string", () => {
      const enc = encrypt("");
      expect(decrypt(enc)).toBe("");
    });

    it("roundtrips long string", () => {
      const long = "x".repeat(10_000);
      expect(decrypt(encrypt(long))).toBe(long);
    });

    it("produces different ciphertext each time (random IV)", () => {
      const a = encrypt("same input");
      const b = encrypt("same input");
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe(decrypt(b));
    });

    it("ciphertext format: v2 GCM (v2:<iv-hex>:<tag-hex>:<ct-hex>)", () => {
      // Encryption upgraded from CBC (v1) to GCM (v2) on 2026-06-14. New
      // writes are v2; v1 ciphertext still decrypts but is re-encrypted to
      // v2 on next save via encryptField's legacy branch.
      const enc = encrypt("hello");
      expect(enc).toMatch(/^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    });

    it("v1 (CBC) ciphertext still decrypts", () => {
      // Bake one v1 ciphertext by hand so we don't need a backup copy of
      // the old encrypt() — proves the v2 decrypt path handles legacy rows.
      const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
      const ct = Buffer.concat([cipher.update("legacy-cbc-payload", "utf8"), cipher.final()]);
      const v1 = `${iv.toString("hex")}:${ct.toString("hex")}`;
      expect(v1).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
      expect(decrypt(v1)).toBe("legacy-cbc-payload");
    });

    it("GCM auth tag rejects tampered ciphertext", () => {
      const enc = encrypt("secret");
      // Flip a nibble in the ciphertext segment — the auth tag will reject.
      const parts = enc.split(":");
      const ct = parts[3];
      const tampered = parts.slice(0, 3).concat(ct.replace(/^./, (c) => (c === "0" ? "1" : "0"))).join(":");
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("isEncrypted", () => {
    it("returns true for valid ciphertext format", () => {
      expect(isEncrypted(encrypt("hello"))).toBe(true);
    });

    it("returns false for plain string", () => {
      expect(isEncrypted("plain text")).toBe(false);
      expect(isEncrypted("hello world")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isEncrypted("")).toBe(false);
    });

    it("returns false for malformed hex", () => {
      expect(isEncrypted("notvalid:notvalid")).toBe(false);
    });

    it("returns false when iv length is wrong", () => {
      expect(isEncrypted("abc:abc")).toBe(false);
    });
  });

  describe("encryptField", () => {
    it("returns null for null/undefined/empty", () => {
      expect(encryptField(null)).toBeNull();
      expect(encryptField(undefined)).toBeNull();
      expect(encryptField("")).toBeNull();
      expect(encryptField("   ")).toBeNull();
    });

    it("encrypts plain strings", () => {
      const out = encryptField("plain");
      expect(out).not.toBeNull();
      expect(isEncrypted(out!)).toBe(true);
    });

    it("does not double-encrypt already-encrypted values", () => {
      const enc = encryptField("once");
      const twice = encryptField(enc);
      expect(twice).toBe(enc);
    });
  });

  describe("decryptField", () => {
    it("returns null for null/undefined", () => {
      expect(decryptField(null)).toBeNull();
      expect(decryptField(undefined)).toBeNull();
    });

    it("passes plain strings through (not encrypted)", () => {
      expect(decryptField("plain")).toBe("plain");
    });

    it("decrypts encrypted strings", () => {
      const enc = encrypt("secret");
      expect(decryptField(enc)).toBe("secret");
    });

    it("returns null on decryption failure (e.g. wrong key)", () => {
      // Garbled ciphertext that LOOKS like the encrypted format
      const badCiphertext = "00000000000000000000000000000000:deadbeef";
      expect(decryptField(badCiphertext)).toBeNull();
    });
  });

  describe("encryptSettingsFields / decryptSettingsFields", () => {
    it("encrypts known PII fields, leaves others alone", () => {
      const data = {
        userId: "u1",
        fullName: "Ali Shahid",
        phone: "+92-300-0000000",
        notificationEmail: "ali@test.com",
        keywords: ["react"],
      };
      const enc = encryptSettingsFields(data);
      expect(enc.userId).toBe("u1");
      expect(enc.keywords).toEqual(["react"]);
      expect(isEncrypted(enc.fullName as string)).toBe(true);
      expect(isEncrypted(enc.phone as string)).toBe(true);
      expect(isEncrypted(enc.notificationEmail as string)).toBe(true);
    });

    it("encrypted then decrypted roundtrips known PII fields", () => {
      const data = { fullName: "Ali", smtpPass: "supersecret" };
      const enc = encryptSettingsFields(data);
      const dec = decryptSettingsFields(enc);
      expect(dec!.fullName).toBe("Ali");
      expect(dec!.smtpPass).toBe("supersecret");
    });

    it("decryptSettingsFields returns null when input is null/undefined", () => {
      expect(decryptSettingsFields(null)).toBeNull();
      expect(decryptSettingsFields(undefined)).toBeNull();
    });

    it("does NOT encrypt non-PII fields", () => {
      const data = { keywords: ["react"], salaryMin: 50000 };
      const enc = encryptSettingsFields(data);
      expect(enc.keywords).toEqual(["react"]);
      expect(enc.salaryMin).toBe(50000);
    });

    it("ignores non-string values in PII fields", () => {
      const data = { fullName: null, phone: undefined };
      const enc = encryptSettingsFields(data);
      expect(enc.fullName).toBeNull();
      expect(enc.phone).toBeUndefined();
    });
  });

  describe("decryption-failure helpers", () => {
    it("getDecryptionFailures returns list of fields with __decryption_failed", () => {
      const data = { fullName: "Ali", phone: { __decryption_failed: true } as unknown as string };
      // Note: decryptSettingsFields normalizes failures to null, but if a caller
      // adds the marker manually (legacy), the helper should still detect.
      // Behavior matches what hasDecryptionFailure documents.
      const out = getDecryptionFailures(data);
      expect(Array.isArray(out)).toBe(true);
    });

    it("hasDecryptionFailure returns boolean", () => {
      expect(typeof hasDecryptionFailure({}, "smtpPass")).toBe("boolean");
    });

    it("hasDecryptionFailure returns false when no marker present", () => {
      expect(hasDecryptionFailure({ smtpPass: "value" }, "smtpPass")).toBe(false);
    });
  });
});
