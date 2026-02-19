import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "jobpilot-admin-session";
const SESSION_TTL = 60 * 60 * 8; // 8 hours

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function makeToken(expiresAt: number): string {
  const payload = `admin:${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): boolean {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);

  const expected = sign(payload);
  if (expected.length !== signature.length) return false;

  const valid = timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) return false;

  const parts = payload.split(":");
  const expiresAt = parseInt(parts[1], 10);
  return Date.now() < expiresAt;
}

export function validateAdminCredentials(
  username: string,
  password: string
): boolean {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  if (!envUser || !envPass) return false;

  const userMatch =
    username.length === envUser.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(envUser));

  const passMatch =
    password.length === envPass.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(envPass));

  return userMatch && passMatch;
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
  cookies().delete(COOKIE_NAME);
}

export function hasValidAdminSession(): boolean {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}
