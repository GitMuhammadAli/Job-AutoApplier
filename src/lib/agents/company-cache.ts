/**
 * In-memory cache for company research results.
 * Single-instance safe for Vercel serverless (per-process cache).
 * Keys are lowercased company names; entries expire after TTL_MS.
 */

import { CompanyResearch } from "./researcher";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  research: CompanyResearch;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(companyName: string): string {
  return companyName.toLowerCase().trim();
}

export function getCachedResearch(companyName: string): CompanyResearch | null {
  const entry = cache.get(cacheKey(companyName));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(cacheKey(companyName));
    return null;
  }
  return entry.research;
}

export function setCachedResearch(
  companyName: string,
  research: CompanyResearch
): void {
  cache.set(cacheKey(companyName), { research, cachedAt: Date.now() });
}

export function getCacheSize(): number {
  return cache.size;
}
