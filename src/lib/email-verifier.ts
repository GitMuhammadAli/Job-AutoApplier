import dns from "dns/promises";

export interface VerifyEmailMXResult {
  valid: boolean;
  hasMX: boolean;
}

// Simple LRU-style cache for MX lookups (avoids repeated DNS queries for same domain)
const mxCache = new Map<string, { hasMX: boolean; cachedAt: number }>();
const MX_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function verifyMxRecord(domain: string): Promise<boolean> {
  if (!domain || domain.length < 3) return false;

  // Check cache first
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.cachedAt < MX_CACHE_TTL_MS) {
    return cached.hasMX;
  }

  try {
    const records = await dns.resolveMx(domain);
    const hasMX = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, { hasMX, cachedAt: Date.now() });

    // Evict old entries if cache grows too large
    if (mxCache.size > 500) {
      const now = Date.now();
      Array.from(mxCache.entries()).forEach(([key, val]) => {
        if (now - val.cachedAt > MX_CACHE_TTL_MS) mxCache.delete(key);
      });
    }

    return hasMX;
  } catch {
    // ENOTFOUND, ENODATA, etc. — domain has no MX records
    mxCache.set(domain, { hasMX: false, cachedAt: Date.now() });
    return false;
  }
}

export async function verifyEmailMX(email: string): Promise<VerifyEmailMXResult> {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return { valid: false, hasMX: false };

  const domain = email.slice(atIndex + 1);
  if (!domain || !domain.includes(".")) return { valid: false, hasMX: false };

  const hasMX = await verifyMxRecord(domain);
  return { valid: hasMX, hasMX };
}
