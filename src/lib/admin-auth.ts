import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";

const COOKIE_NAME = "jobpilot-admin-session";
const SESSION_TTL = 60 * 60 * 8; // 8 hours

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is required");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function makeToken(expiresAt: number): string {
  const payload = `admin:${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): boolean {
  try {
    const lastDot = token.lastIndexOf(".");
    if (lastDot === -1) return false;

    const payload = token.slice(0, lastDot);
    const signature = token.slice(lastDot + 1);

    const expected = sign(payload);
    if (expected.length !== signature.length) return false;

    const expectedBuf = Buffer.from(expected, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== signatureBuf.length) return false;

    if (!timingSafeEqual(expectedBuf, signatureBuf)) return false;

    const parts = payload.split(":");
    const expiresAt = parseInt(parts[1], 10);
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Hash a password for storage (e.g. to generate ADMIN_PASSWORD_HASH env var).
 * Usage: node -e "const {scryptSync,randomBytes}=require('crypto');const s=randomBytes(16).toString('hex');console.log(s+':'+scryptSync('YOUR_PASSWORD',s,64).toString('hex'))"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  // Require hashed format (salt:hash) — plaintext passwords are rejected
  if (!stored.includes(":") || stored.length <= 100) {
    console.error(
      "[AdminAuth] ADMIN_PASSWORD_HASH is not in hashed format. " +
      "Generate one with: node -e \"const{scryptSync,randomBytes}=require('crypto');const s=randomBytes(16).toString('hex');console.log(s+':'+scryptSync('YOUR_PASSWORD',s,64).toString('hex'))\""
    );
    return false;
  }
  const [salt, hash] = stored.split(":");
  const testHash = scryptSync(password, salt, 64).toString("hex");
  return safeEqual(testHash, hash);
}

export function validateAdminCredentials(
  username: string,
  password: string
): boolean {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass || !username || !password) return false;
  return safeEqual(username, envUser) && verifyPassword(password, envPass);
}

export function createAdminSession(): void {
  const expiresAt = Date.now() + SESSION_TTL * 1000;
  const token = makeToken(expiresAt);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export function destroyAdminSession(): void {
  try {
    cookies().delete(COOKIE_NAME);
  } catch {
    // Ignore — may be called outside request context
  }
}

export function hasValidAdminSession(): boolean {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return false;
    return verifyToken(token);
  } catch {
    return false;
  }
}
