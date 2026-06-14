/**
 * SSRF-safe fetch.
 *
 * Default `fetch()` will happily call internal IPs (169.254.169.254 metadata,
 * 127.0.0.1, 10.x, 192.168.x, ::1, fc00::/7, etc) — which is fine for AWS but
 * lets a user-supplied URL on `/api/jobs/extract-url`, `email-extractor`, the
 * job-page researcher, etc reach our own infrastructure.
 *
 * This wrapper:
 *   1. Validates protocol (https/http only) — no file://, gopher://, data:.
 *   2. Resolves the hostname → IPs and rejects any IP in a private range.
 *   3. Forces a per-call timeout (default 10s).
 *   4. Caps the response size to prevent 5GB ZIP bombs.
 *   5. Follows redirects manually so each hop is also checked.
 *
 * Callers stay simple — `safeFetch(url, { timeoutMs })` returns a Response.
 *
 * Note: DNS rebinding is a known limitation (resolve → check → fetch happens
 * in two separate steps and an attacker-controlled DNS could swap the answer
 * between them). Acceptable for now since our targets aren't long-lived.
 */

import dns from "node:dns/promises";
import net from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export class SsrfBlockedError extends Error {
  readonly name = "SsrfBlockedError";
  readonly url: string;
  readonly reason: string;
  constructor(url: string, reason: string) {
    super(`Blocked SSRF-suspicious URL: ${reason}`);
    this.url = url;
    this.reason = reason;
  }
}

export interface SafeFetchOptions extends Omit<RequestInit, "redirect"> {
  /** Per-call timeout in ms. Default 10_000. */
  timeoutMs?: number;
  /** Max response bytes. Default 10MB. */
  maxBytes?: number;
  /** Hard-allow these host patterns even if their IP looks private. */
  allowHosts?: string[];
}

/**
 * Returns true when an IP belongs to a private / loopback / link-local /
 * metadata range. Covers RFC1918 v4 + most v6 equivalents + 169.254 metadata
 * + 100.64/10 (CGNAT, Vercel internal).
 */
export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return false;

  if (family === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true;                    // 0.0.0.0/8
    if (a === 10) return true;                   // 10.0.0.0/8
    if (a === 127) return true;                  // loopback
    if (a === 169 && b === 254) return true;     // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;     // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                   // multicast + reserved
    return false;
  }

  // v6
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true;     // link-local
  if (lower.startsWith("ff")) return true;       // multicast
  // IPv4-mapped — check the v4 portion.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

async function assertSafeHost(targetUrl: URL, allowHosts: string[] | undefined): Promise<void> {
  if (!ALLOWED_PROTOCOLS.has(targetUrl.protocol)) {
    throw new SsrfBlockedError(targetUrl.toString(), `protocol ${targetUrl.protocol} not allowed`);
  }
  const host = targetUrl.hostname;
  if (!host) {
    throw new SsrfBlockedError(targetUrl.toString(), "empty hostname");
  }
  // Reject localhost-by-name shortcuts before we hit DNS.
  if (/^(localhost|0\.0\.0\.0|broadcasthost)$/i.test(host)) {
    throw new SsrfBlockedError(targetUrl.toString(), `host ${host} is blocked`);
  }
  if (allowHosts?.some((p) => host === p || host.endsWith(`.${p}`))) {
    return;
  }
  // If host is already a literal IP, check it directly. Otherwise resolve.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new SsrfBlockedError(targetUrl.toString(), `host IP ${host} is private`);
    }
    return;
  }
  const lookups = await dns.lookup(host, { all: true });
  for (const r of lookups) {
    if (isPrivateIp(r.address)) {
      throw new SsrfBlockedError(targetUrl.toString(), `host ${host} resolves to private IP ${r.address}`);
    }
  }
}

export async function safeFetch(rawUrl: string | URL, opts: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, allowHosts, ...init } = opts;
  let url: URL;
  try {
    url = typeof rawUrl === "string" ? new URL(rawUrl) : rawUrl;
  } catch {
    throw new SsrfBlockedError(String(rawUrl), "invalid URL");
  }

  let redirects = 0;
  while (true) {
    await assertSafeHost(url, allowHosts);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
      if (isAbort) {
        throw new Error(`safeFetch: ${url.toString()} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }

    // Follow redirects manually — every hop must pass the SSRF check.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      if (redirects >= MAX_REDIRECTS) {
        throw new Error(`safeFetch: too many redirects (>${MAX_REDIRECTS})`);
      }
      redirects += 1;
      url = new URL(location, url);
      continue;
    }

    // Size cap — read the stream and short-circuit if it exceeds the limit.
    if (!response.body) return response;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new Error(`safeFetch: response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return new Response(buf, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
}
