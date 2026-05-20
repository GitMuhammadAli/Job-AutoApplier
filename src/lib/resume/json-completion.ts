/**
 * Multi-provider structured-JSON completion with fail-over.
 *
 * Tries Groq first (free, fast, supports response_format: json_object).
 * On rate-limit / quota / transient error, falls back to Gemini Flash
 * (free tier 1500 req/day, supports responseMimeType: application/json).
 *
 * Returns the raw JSON string + which provider succeeded + the per-provider
 * attempt log so the caller can surface "fell back to Gemini" to the user
 * if they care.
 *
 * Ported from DevRadar's `jsonCompleteWithFallback` (kept verbatim per
 * the design decision doc).
 */

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type LLMProviderName = "groq" | "gemini";

export interface JsonCompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Skip providers entirely (e.g. user disabled). */
  skip?: LLMProviderName[];
}

export interface JsonCompletionResult {
  raw: string;
  provider: LLMProviderName;
  attempts: Array<{ provider: LLMProviderName; ok: boolean; error?: string }>;
}

function isQuotaOrTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "");
  return /\b(429|rate.?limit|quota|tokens.?per.?day|TPD|too\s+many\s+requests|timeout|ECONNRESET|ETIMEDOUT|503|502)\b/i.test(
    msg,
  );
}

function looksLikeAuthError(msg: string): boolean {
  return /\b(401|403|invalid.?api.?key|invalid.?key|unauthorized|forbidden)\b/i.test(msg);
}

// ── Provider clients (lazy, cached) ──────────────────────────────────

let groqClient: Groq | null = null;
function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

let geminiClient: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI | null {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(key);
  return geminiClient;
}

// ── Individual provider calls ────────────────────────────────────────

async function callGroq(opts: JsonCompletionOptions): Promise<string> {
  const client = getGroq();
  if (!client) throw new Error("GROQ_API_KEY not configured");
  const completion = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 1024,
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty response");
  return raw;
}

async function callGemini(opts: JsonCompletionOptions): Promise<string> {
  const client = getGemini();
  if (!client) throw new Error("GOOGLE_AI_API_KEY not configured");
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxTokens ?? 1024,
      responseMimeType: "application/json",
    },
    systemInstruction: opts.systemPrompt,
  });
  const result = await model.generateContent(opts.userPrompt);
  const raw = result.response.text();
  if (!raw) throw new Error("Gemini returned empty response");
  return raw;
}

const PROVIDER_ORDER: Array<{
  name: LLMProviderName;
  call: (o: JsonCompletionOptions) => Promise<string>;
}> = [
  { name: "groq", call: callGroq },
  { name: "gemini", call: callGemini },
];

/**
 * Run the fallback chain until one succeeds. Throws only if all configured
 * providers fail. A provider with no API key is skipped silently (treated as
 * not-configured, not an error).
 *
 * Auth errors fail fast — there's no point burning the next provider's quota
 * if the failure was a misconfigured key on the current one.
 */
export async function jsonCompleteWithFallback(
  opts: JsonCompletionOptions,
): Promise<JsonCompletionResult> {
  const skip = new Set(opts.skip ?? []);
  const attempts: JsonCompletionResult["attempts"] = [];
  let lastError: unknown;

  for (const provider of PROVIDER_ORDER) {
    if (skip.has(provider.name)) continue;
    try {
      const raw = await provider.call(opts);
      attempts.push({ provider: provider.name, ok: true });
      return { raw, provider: provider.name, attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ provider: provider.name, ok: false, error: msg });
      lastError = err;
      // Skip "not configured" silently. Fail fast on real auth errors.
      const isConfigError = /not configured|missing api/i.test(msg);
      if (!isConfigError && looksLikeAuthError(msg) && !isQuotaOrTransientError(err)) {
        throw err;
      }
    }
  }

  throw new Error(
    `All AI providers failed. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }. Attempts: ${attempts.map((a) => `${a.provider}=${a.ok ? "ok" : "err"}`).join(", ")}`,
  );
}
