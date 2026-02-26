export type EmailErrorType =
  | "permanent"
  | "transient"
  | "rate_limit"
  | "auth"
  | "network";

export interface ClassifiedError {
  type: EmailErrorType;
  retryable: boolean;
  message: string;
  code?: string;
}

const PERMANENT_CODES = [
  "550", "551", "552", "553", "554", "521", "523", "541", "556",
];

const PERMANENT_PHRASES = [
  "relay access denied",
  "address rejected",
  "address not found",
  "recipient rejected",
  "does not exist",
  "user unknown",
  "no such user",
  "mailbox not found",
  "mailbox unavailable",
  "mailbox disabled",
  "account disabled",
  "account does not exist",
  "invalid recipient",
  "delivery not allowed",
  "message rejected",
  "domain not found",
  "undeliverable",
];

const RATE_LIMIT_PHRASES = [
  "too many",
  "rate limit",
  "rate exceeded",
  "too many connections",
  "too many messages",
  "too many recipients",
  "throttl",
  "please try again later",
  "service temporarily unavailable",
  "try again in",
  "exceeded the maximum",
  "quota exceeded",
  "sending rate",
  "daily sending quota",
  "limit reached",
];

const AUTH_PHRASES = [
  "authentication",
  "auth failed",
  "invalid credentials",
  "incorrect password",
  "invalid login",
  "application-specific password",
  "username and password not accepted",
  "login failed",
  "535",
  "534",
];

const NETWORK_PATTERNS = [
  "econnreset",
  "etimedout",
  "econnrefused",
  "enotfound",
  "ehostunreach",
  "epipe",
  "socket hang up",
  "connection timed out",
  "connection refused",
  "network unreachable",
  "dns resolution failed",
];

export function classifyError(error: unknown): ClassifiedError {
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.toLowerCase();

  // Extract numeric SMTP response code from nodemailer error object if available
  const responseCode =
    error && typeof error === "object" && "responseCode" in error
      ? (error as { responseCode?: number }).responseCode
      : undefined;

  // Auth errors — not retryable, user needs to fix credentials
  if (responseCode === 535 || responseCode === 534) {
    return { type: "auth", retryable: false, message: raw, code: String(responseCode) };
  }
  if (AUTH_PHRASES.some((p) => msg.includes(p))) {
    return { type: "auth", retryable: false, message: raw };
  }

  // Rate limit — retryable after waiting
  if (RATE_LIMIT_PHRASES.some((p) => msg.includes(p))) {
    return { type: "rate_limit", retryable: true, message: raw };
  }

  // Permanent SMTP rejection — use responseCode first, then word-boundary match
  if (responseCode && PERMANENT_CODES.includes(String(responseCode))) {
    return { type: "permanent", retryable: false, message: raw, code: String(responseCode) };
  }
  const matchedCode = PERMANENT_CODES.find((code) => new RegExp(`\\b${code}\\b`).test(msg));
  if (matchedCode) {
    return { type: "permanent", retryable: false, message: raw, code: matchedCode };
  }
  if (PERMANENT_PHRASES.some((p) => msg.includes(p))) {
    return { type: "permanent", retryable: false, message: raw };
  }

  // Network errors — retryable
  if (NETWORK_PATTERNS.some((p) => msg.includes(p))) {
    return { type: "network", retryable: true, message: raw };
  }

  // SMTP 4xx are transient (use responseCode or regex with word boundaries)
  if (responseCode && responseCode >= 400 && responseCode < 500) {
    return { type: "transient", retryable: true, message: raw, code: String(responseCode) };
  }
  if (/\b4[0-9]{2}\b/.test(msg)) {
    return { type: "transient", retryable: true, message: raw };
  }

  // Default: treat unknown errors as transient (retry a few times)
  return { type: "transient", retryable: true, message: raw };
}
