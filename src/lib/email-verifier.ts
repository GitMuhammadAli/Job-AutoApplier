import dns from "dns/promises";
import net from "net";

export interface VerifyEmailMXResult {
  valid: boolean;
  hasMX: boolean;
}

export interface VerifyRecipientResult {
  exists: boolean;
  mxHost: string | null;
  smtpCode?: number;
  message?: string;
}

const mxCache = new Map<string, { hasMX: boolean; mxHost: string | null; cachedAt: number }>();
const MX_CACHE_TTL_MS = 30 * 60 * 1000;

// Cache RCPT TO results to avoid hammering mail servers
const rcptCache = new Map<string, { exists: boolean; cachedAt: number }>();
const RCPT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function resolveMxHost(domain: string): Promise<{ hasMX: boolean; mxHost: string | null }> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.cachedAt < MX_CACHE_TTL_MS) {
    return { hasMX: cached.hasMX, mxHost: cached.mxHost };
  }

  try {
    const records = await dns.resolveMx(domain);
    const sorted = (records || []).sort((a, b) => a.priority - b.priority);
    const hasMX = sorted.length > 0;
    const mxHost = hasMX ? sorted[0].exchange : null;
    mxCache.set(domain, { hasMX, mxHost, cachedAt: Date.now() });

    if (mxCache.size > 500) {
      const now = Date.now();
      Array.from(mxCache.entries()).forEach(([key, val]) => {
        if (now - val.cachedAt > MX_CACHE_TTL_MS) mxCache.delete(key);
      });
    }

    return { hasMX, mxHost };
  } catch {
    mxCache.set(domain, { hasMX: false, mxHost: null, cachedAt: Date.now() });
    return { hasMX: false, mxHost: null };
  }
}

export async function verifyMxRecord(domain: string): Promise<boolean> {
  if (!domain || domain.length < 3) return false;
  const { hasMX } = await resolveMxHost(domain);
  return hasMX;
}

/**
 * Verifies a recipient email exists via SMTP RCPT TO handshake.
 * Connects to the domain's MX server, sends EHLO + MAIL FROM + RCPT TO,
 * then checks the response code. Does NOT send any actual email.
 *
 * Returns exists: true if the server accepts the recipient (2xx response),
 * false if rejected (5xx) or verification times out / fails.
 *
 * Limitations: some servers accept all RCPT TO (catch-all) — these return
 * exists: true even for invalid addresses. Still better than blind guessing.
 */
export async function verifyRecipient(email: string): Promise<VerifyRecipientResult> {
  const emailLower = email.toLowerCase().trim();

  const rcptCached = rcptCache.get(emailLower);
  if (rcptCached && Date.now() - rcptCached.cachedAt < RCPT_CACHE_TTL_MS) {
    return { exists: rcptCached.exists, mxHost: null, message: "cached" };
  }

  const atIdx = emailLower.lastIndexOf("@");
  if (atIdx === -1) return { exists: false, mxHost: null, message: "invalid email format" };

  const domain = emailLower.slice(atIdx + 1);
  const { hasMX, mxHost } = await resolveMxHost(domain);
  if (!hasMX || !mxHost) {
    return { exists: false, mxHost: null, message: "no MX records" };
  }

  const TIMEOUT_MS = 8000;

  return new Promise<VerifyRecipientResult>((resolve) => {
    const socket = new net.Socket();
    let step = 0; // 0=greeting, 1=EHLO sent, 2=MAIL FROM sent, 3=RCPT TO sent
    let resolved = false;
    let buffer = "";

    const done = (result: VerifyRecipientResult) => {
      if (resolved) return;
      resolved = true;
      rcptCache.set(emailLower, { exists: result.exists, cachedAt: Date.now() });
      if (rcptCache.size > 1000) {
        const now = Date.now();
        Array.from(rcptCache.entries()).forEach(([key, val]) => {
          if (now - val.cachedAt > RCPT_CACHE_TTL_MS) rcptCache.delete(key);
        });
      }
      try { socket.write("QUIT\r\n"); } catch { /* ignore */ }
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({ exists: false, mxHost, message: "timeout" });
    }, TIMEOUT_MS);

    socket.setTimeout(TIMEOUT_MS);
    socket.on("timeout", () => done({ exists: false, mxHost, message: "socket timeout" }));
    socket.on("error", () => done({ exists: false, mxHost, message: "connection error" }));

    socket.on("data", (data) => {
      buffer += data.toString();

      // Wait for complete response line(s)
      if (!buffer.includes("\r\n") && !buffer.includes("\n")) return;

      const lines = buffer.split(/\r?\n/);
      buffer = "";
      const lastLine = lines.filter((l) => l.trim()).pop() || "";
      const code = parseInt(lastLine.substring(0, 3), 10);

      if (step === 0) {
        // Server greeting
        if (code >= 200 && code < 300) {
          step = 1;
          socket.write("EHLO verify.jobpilot.app\r\n");
        } else {
          done({ exists: false, mxHost, smtpCode: code, message: "bad greeting" });
        }
      } else if (step === 1) {
        if (code >= 200 && code < 300) {
          step = 2;
          socket.write("MAIL FROM:<verify@jobpilot.app>\r\n");
        } else {
          done({ exists: false, mxHost, smtpCode: code, message: "EHLO rejected" });
        }
      } else if (step === 2) {
        if (code >= 200 && code < 300) {
          step = 3;
          socket.write(`RCPT TO:<${emailLower}>\r\n`);
        } else {
          done({ exists: false, mxHost, smtpCode: code, message: "MAIL FROM rejected" });
        }
      } else if (step === 3) {
        clearTimeout(timer);
        if (code >= 200 && code < 300) {
          done({ exists: true, mxHost, smtpCode: code, message: "accepted" });
        } else {
          done({ exists: false, mxHost, smtpCode: code, message: lastLine });
        }
      }
    });

    socket.connect(25, mxHost);
  });
}

export async function verifyEmailMX(email: string): Promise<VerifyEmailMXResult> {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return { valid: false, hasMX: false };

  const domain = email.slice(atIndex + 1);
  if (!domain || !domain.includes(".")) return { valid: false, hasMX: false };

  const hasMX = await verifyMxRecord(domain);
  return { valid: hasMX, hasMX };
}
