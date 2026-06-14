import crypto from "crypto";

/**
 * Encryption upgrade — 2026-06-14:
 *   v1: aes-256-cbc, format `<iv-hex>:<ct-hex>` (no auth tag → ciphertext
 *       can be tampered with silently).
 *   v2: aes-256-gcm, format `v2:<iv-hex>:<tag-hex>:<ct-hex>` (auth tag
 *       enforces integrity; tampering throws on decrypt).
 *
 * New writes always go through v2. decrypt() auto-detects format so
 * existing CBC ciphertexts keep decrypting until the user re-saves the
 * field (encryptField re-encrypts under v2 on next write). No big-bang
 * migration required.
 */

const ALGO_CBC = "aes-256-cbc";
const ALGO_GCM = "aes-256-gcm";
const IV_LENGTH_CBC = 16;
const IV_LENGTH_GCM = 12;
const GCM_TAG_LENGTH = 16;
const V2_PREFIX = "v2:";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY env var is required for data encryption");
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  // Always write v2 (GCM).
  const iv = crypto.randomBytes(IV_LENGTH_GCM);
  const cipher = crypto.createCipheriv(ALGO_GCM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${V2_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(text: string): string {
  if (text.startsWith(V2_PREFIX)) {
    const parts = text.slice(V2_PREFIX.length).split(":");
    if (parts.length !== 3) throw new Error("Invalid v2 ciphertext shape");
    const [ivHex, tagHex, ctHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    if (tag.length !== GCM_TAG_LENGTH) throw new Error("Invalid GCM auth tag length");
    const decipher = crypto.createDecipheriv(ALGO_GCM, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  }
  // Legacy v1 CBC — kept for read-back of pre-upgrade rows.
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO_CBC, getKey(), iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function isEncrypted(text: string): boolean {
  // v2 GCM or legacy v1 CBC.
  if (text.startsWith(V2_PREFIX)) {
    return /^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(text);
  }
  return /^[0-9a-f]{32}:[0-9a-f]+$/.test(text);
}

/** True if the ciphertext is the legacy v1 (CBC, no auth tag). */
export function isLegacyV1(text: string): boolean {
  return !text.startsWith(V2_PREFIX) && /^[0-9a-f]{32}:[0-9a-f]+$/.test(text);
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  if (isEncrypted(value)) {
    // Already-encrypted pass-through — but if it's still on legacy v1, upgrade
    // it transparently. Re-encrypts under v2 on every save so the auth-tag-less
    // CBC rows drain naturally without a one-shot migration script.
    if (isLegacyV1(value)) {
      try {
        return encrypt(decrypt(value));
      } catch {
        // Stale key or tampered row — leave it alone; decryptField will
        // surface the failure on the next read.
        return value;
      }
    }
    return value;
  }
  return encrypt(value);
}

export function decryptField(value: string | null | undefined, fieldName?: string): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch (err) {
    console.error(`[Encryption] Decryption failed${fieldName ? ` for '${fieldName}'` : ""} — returning null. ENCRYPTION_KEY may have been rotated. Re-save the field in Settings to re-encrypt.`, err instanceof Error ? err.message : err);
    return null;
  }
}

const PII_FIELDS = [
  "fullName",
  "phone",
  "linkedinUrl",
  "portfolioUrl",
  "githubUrl",
  "notificationEmail",
  "applicationEmail",
  "smtpHost",
  "smtpUser",
  "smtpPass",
  "defaultSignature",
  "customClosing",
  "customSystemPrompt",
] as const;

type PIIField = (typeof PII_FIELDS)[number];

/**
 * Encrypts all PII string fields on a settings-like object before DB write.
 * Returns a new object with encrypted values.
 */
export function encryptSettingsFields<T extends Record<string, any>>(data: T): T {
  const result = { ...data } as Record<string, unknown>;
  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === "string") {
      result[field] = encryptField(result[field] as string);
    }
  }
  return result as T;
}

/**
 * Decrypts all PII string fields on a settings object after DB read.
 * Safe to call on already-decrypted data (no-ops on plaintext).
 * Accepts null/undefined and returns them as-is.
 */
export function decryptSettingsFields<T extends Record<string, any>>(data: T): T;
export function decryptSettingsFields<T extends Record<string, any>>(data: T | null | undefined): T | null;
export function decryptSettingsFields<T extends Record<string, any>>(data: T | null | undefined): T | null {
  if (!data) return null;
  const result = { ...data } as Record<string, unknown>;
  const failedFields: string[] = [];
  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === "string") {
      const raw = result[field] as string;
      const decrypted = decryptField(raw);
      if (decrypted === null && isEncrypted(raw)) {
        failedFields.push(field);
      }
      result[field] = decrypted;
    }
  }
  if (failedFields.length > 0) {
    (result as Record<string, unknown>)._decryptionFailures = failedFields;
    console.error(`[Encryption] Failed to decrypt fields: ${failedFields.join(", ")}. ENCRYPTION_KEY may have been rotated.`);
  }
  return result as T;
}

/**
 * Returns the list of fields that failed decryption, or empty array if all succeeded.
 * Use after decryptSettingsFields() to detect broken encryption vs "field not set".
 */
export function getDecryptionFailures(data: Record<string, unknown>): string[] {
  return (data?._decryptionFailures as string[]) ?? [];
}

/**
 * Returns true if any of the specified fields failed decryption.
 * Shorthand for checking critical fields like SMTP credentials.
 */
export function hasDecryptionFailure(data: Record<string, unknown>, ...fields: string[]): boolean {
  const failures = getDecryptionFailures(data);
  if (failures.length === 0) return false;
  if (fields.length === 0) return true;
  return fields.some(f => failures.includes(f));
}
