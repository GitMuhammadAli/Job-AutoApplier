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

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encryptSettingsFields<T extends Record<string, any>>(data: T): T {
  const result = { ...data };
  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === "string") {
      result[field] = encryptField(result[field] as string);
    }
  }
  return result;
}

/**
 * Decrypts all PII string fields on a settings object after DB read.
 * Safe to call on already-decrypted data (no-ops on plaintext).
 * Accepts null/undefined and returns them as-is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptSettingsFields<T extends Record<string, any>>(data: T | null | undefined): T {
  if (!data) return data as T;
  const result = { ...data };
  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === "string") {
      result[field] = decryptField(result[field] as string);
    }
  }
  return result;
}
