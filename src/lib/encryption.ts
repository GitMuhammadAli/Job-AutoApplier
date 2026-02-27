import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY env var is required for data encryption");
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function isEncrypted(text: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]+$/.test(text);
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  if (isEncrypted(value)) return value;
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
