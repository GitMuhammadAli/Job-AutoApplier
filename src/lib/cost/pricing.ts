/**
 * Per-provider, per-model pricing for AI calls.
 *
 * Values are dollars per 1M tokens (matches the public price lists). Update
 * when providers re-price — no other code change needed since `priceOf()`
 * defaults to 0 for unknown models.
 *
 * Source: provider pricing pages snapshot 2026-06-14. Numbers below cover
 * the models we actually call in production; the rest will silently log
 * with cost=0 until added. Keep this list short on purpose — wide-net
 * "every model on every provider" is noise we don't need.
 */

export interface ModelPrice {
  /** $ per 1M input tokens. */
  inputPerM: number;
  /** $ per 1M output tokens. */
  outputPerM: number;
}

export const PROVIDER_PRICING: Record<string, Record<string, ModelPrice>> = {
  groq: {
    "llama-3.3-70b-versatile": { inputPerM: 0.59, outputPerM: 0.79 },
    "llama-3.1-8b-instant":    { inputPerM: 0.05, outputPerM: 0.08 },
    "llama-3.1-70b-versatile": { inputPerM: 0.59, outputPerM: 0.79 }, // legacy alias
    "mixtral-8x7b-32768":      { inputPerM: 0.24, outputPerM: 0.24 },
  },
  gemini: {
    "gemini-2.0-flash":       { inputPerM: 0.10, outputPerM: 0.40 },
    "gemini-1.5-flash":       { inputPerM: 0.075, outputPerM: 0.30 },
    "gemini-1.5-pro":         { inputPerM: 1.25, outputPerM: 5.00 },
  },
};

/**
 * Compute the dollar cost of a single call. Returns 0 when the model isn't
 * in the price table — the caller still records the call, just without a
 * cost figure (better than throwing on an unknown SKU mid-request).
 */
export function priceOf(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const row = PROVIDER_PRICING[provider]?.[model];
  if (!row) return 0;
  const inCost = (inputTokens / 1_000_000) * row.inputPerM;
  const outCost = (outputTokens / 1_000_000) * row.outputPerM;
  // Round to 6 decimal places so micro-cents don't blow up the float.
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
}

/**
 * Format a cost for UI display. Sub-cent shows micro-dollars, ≥ 1¢ shows
 * cents, ≥ $1 shows dollars.
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.0001) return `<$0.0001`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
