/**
 * Lightweight Groq API wrapper for AI text generation with retry/backoff,
 * per-call timeout, and Gemini fallback.
 */

import { TIMEOUTS } from "./constants";
import { logApiCall } from "./api-usage-logger";
import {
  checkQuota,
  estimateTokens,
  recordUsage,
  QuotaExceededError,
} from "./quota/quota";

interface GroqOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
  /**
   * Pass `{ userId, route }` to enforce the token quota. When omitted the call
   * skips quota accounting — used by internal/cron paths that don't have a user
   * scope. Every user-initiated call site SHOULD pass this.
   */
  quota?: { userId: string; route: string };
  /** Per-call timeout in milliseconds. Defaults to 30_000. */
  timeoutMs?: number;
  /** Set true to skip the Gemini fallback when Groq fails. */
  skipFallback?: boolean;
}

/** Backoff schedule (ms) used for 429 / rate_limit_exceeded retries. */
const RATE_LIMIT_BACKOFF_MS = [5_000, 15_000, 30_000] as const;
const MAX_RETRIES = RATE_LIMIT_BACKOFF_MS.length;
const DEFAULT_TIMEOUT_MS = 30_000;

export type AIProvider = "groq" | "gemini";

export interface GenerateResult {
  text: string;
  provider: AIProvider;
  /** Total number of Groq attempts made (including the first try). */
  attempts: number;
  totalLatencyMs: number;
}

/**
 * Thrown when Groq is rate-limited AND fallback either failed or was disabled.
 * Callers can inspect `retryAfterSeconds` to surface a user-facing wait hint.
 */
export class AIRateLimitError extends Error {
  readonly name = "AIRateLimitError";
  readonly retryAfterSeconds: number;
  readonly provider: AIProvider;

  constructor(message: string, retryAfterSeconds: number, provider: AIProvider = "groq") {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
    this.provider = provider;
  }
}

/** Apply ±20% jitter to a backoff delay. */
function jitter(ms: number): number {
  const delta = ms * 0.2;
  return Math.round(ms + (Math.random() * 2 - 1) * delta);
}

/** Best-effort parse of `retry-after` header → seconds. */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const secs = parseInt(value, 10);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}

/**
 * Returns a ReadableStream of raw text tokens from Groq.
 * Each chunk written to the stream is a decoded text delta string.
 */
export function streamWithGroq(
  systemPrompt: string,
  userPrompt: string,
  options: GroqOptions = {}
): ReadableStream<Uint8Array> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const encoder = new TextEncoder();
  const timeoutMs = options.timeoutMs ?? Math.max(DEFAULT_TIMEOUT_MS, TIMEOUTS.AI_TIMEOUT_MS);
  const model = options.model || "llama-3.1-8b-instant";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const callStartedAt = Date.now();
      let outputTokensEst = 0;

      // Pre-flight quota check — parity with generateWithGroqDetailed.
      if (options.quota) {
        const est = estimateTokens(systemPrompt) + estimateTokens(userPrompt) + (options.max_tokens ?? 800);
        try {
          const gate = await checkQuota(options.quota.userId, "groq", est);
          if (!gate.allowed) {
            await recordUsage({
              userId: options.quota.userId,
              provider: "groq",
              model,
              route: options.quota.route,
              inputTokens: 0,
              outputTokens: 0,
              latencyMs: 0,
              status: gate.reason === "global_cap" ? "rejected_global" : "rejected_quota",
            });
            controller.error(new QuotaExceededError(gate.reason, gate.retryAfterSeconds));
            return;
          }
        } catch (err) {
          controller.error(err);
          return;
        }
      }

      const abortController = new AbortController();
      const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 800,
            stream: true,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "Unknown error");
          controller.error(new Error(`Groq stream error (${response.status}): ${errText.slice(0, 200)}`));
          return;
        }

        if (!response.body) {
          controller.error(new Error("Groq returned no response body"));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                outputTokensEst += estimateTokens(delta);
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // malformed line — skip
            }
          }
        }

        await logApiCall("groq");

        if (options.quota) {
          await recordUsage({
            userId: options.quota.userId,
            provider: "groq",
            model,
            route: options.quota.route,
            inputTokens: estimateTokens(systemPrompt) + estimateTokens(userPrompt),
            outputTokens: outputTokensEst,
            latencyMs: Date.now() - callStartedAt,
            status: "ok",
          }).catch(() => {});
        }

        controller.close();
      } catch (err) {
        const isAbort = err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
        if (isAbort) {
          controller.error(new Error(`Groq stream timed out after ${timeoutMs}ms`));
        } else {
          controller.error(err);
        }
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  });
}

/**
 * Backward-compatible string return. Internally delegates to the detailed form
 * so callers that just want the text continue to work unchanged.
 */
export async function generateWithGroq(
  systemPrompt: string,
  userPrompt: string,
  options: GroqOptions = {}
): Promise<string> {
  const result = await generateWithGroqDetailed(systemPrompt, userPrompt, options);
  return result.text;
}

/**
 * Full result form. Exposes provider, attempts, and latency for telemetry.
 */
export async function generateWithGroqDetailed(
  systemPrompt: string,
  userPrompt: string,
  options: GroqOptions = {}
): Promise<GenerateResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  // Pre-flight quota check — only when caller passed a quota scope
  if (options.quota) {
    const est = estimateTokens(systemPrompt) + estimateTokens(userPrompt) + (options.max_tokens ?? 800);
    const gate = await checkQuota(options.quota.userId, "groq", est);
    if (!gate.allowed) {
      await recordUsage({
        userId: options.quota.userId,
        provider: "groq",
        model: options.model || "llama-3.1-8b-instant",
        route: options.quota.route,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: gate.reason === "global_cap" ? "rejected_global" : "rejected_quota",
      });
      throw new QuotaExceededError(gate.reason, gate.retryAfterSeconds);
    }
  }

  const timeoutMs = options.timeoutMs ?? Math.max(DEFAULT_TIMEOUT_MS, TIMEOUTS.AI_TIMEOUT_MS);
  const callStartedAt = Date.now();
  let attempts = 0;
  let lastRateLimitRetryAfter = 0;
  let lastError: unknown;
  let rateLimited = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts = attempt + 1;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model || "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      // Rate-limit detection — 429 status OR rate_limit_exceeded error code.
      let isRateLimited = response.status === 429;
      let rateLimitErrText: string | undefined;
      if (!isRateLimited && !response.ok) {
        // Peek body for an `error.code === "rate_limit_exceeded"` signal.
        const cloned = response.clone();
        rateLimitErrText = await cloned.text().catch(() => "");
        if (rateLimitErrText && /rate[_ ]?limit[_ ]?exceeded/i.test(rateLimitErrText)) {
          isRateLimited = true;
        }
      }

      if (isRateLimited) {
        rateLimited = true;
        const retryAfterSecs = parseRetryAfter(response.headers.get("retry-after"));
        if (retryAfterSecs) lastRateLimitRetryAfter = retryAfterSecs;
        if (attempt < MAX_RETRIES) {
          const baseWait = RATE_LIMIT_BACKOFF_MS[attempt];
          const waitMs = jitter(retryAfterSecs ? Math.max(retryAfterSecs * 1000, baseWait) : baseWait);
          console.warn(
            `[Groq] rate-limited — retry attempt ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`
          );
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        // Exhausted retries — break out and try Gemini fallback below.
        lastError = new AIRateLimitError(
          "Groq rate limit exhausted after retries",
          lastRateLimitRetryAfter || Math.ceil(RATE_LIMIT_BACKOFF_MS[MAX_RETRIES - 1] / 1000),
        );
        break;
      }

      if (response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const waitMs = jitter(2000 * (attempt + 1));
          console.warn(`[Groq] 5xx ${response.status} — retry attempt ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

      if (!response.ok) {
        const errText = rateLimitErrText ?? (await response.text().catch(() => "Unknown error"));
        console.error(`[Groq] Non-retryable error ${response.status}:`, errText);
        throw new Error(`AI service error (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("AI returned an empty response. Please try again.");

      await logApiCall("groq");

      if (options.quota) {
        // OpenAI-compatible usage shape returned by Groq
        const inputTokens = data.usage?.prompt_tokens ?? estimateTokens(systemPrompt) + estimateTokens(userPrompt);
        const outputTokens = data.usage?.completion_tokens ?? estimateTokens(text);
        await recordUsage({
          userId: options.quota.userId,
          provider: "groq",
          model: options.model || "llama-3.1-8b-instant",
          route: options.quota.route,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - callStartedAt,
          status: "ok",
        });
      }

      return {
        text,
        provider: "groq",
        attempts,
        totalLatencyMs: Date.now() - callStartedAt,
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      lastError = err;
      const isAbort = err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
      if (isAbort) {
        lastError = new Error(`AI request timed out after ${timeoutMs}ms`);
        // Timeout — bail out of Groq retries and try fallback immediately.
        console.warn(`[Groq] timeout after ${timeoutMs}ms on attempt ${attempt + 1} — aborting Groq retries`);
        break;
      }
      if (attempt < MAX_RETRIES) {
        const waitMs = jitter(2000 * (attempt + 1));
        console.warn(`[Groq] transient error — retry attempt ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }

  // Helper — records a single error row to LlmCallLog so dashboards see
  // failure rates per provider/model/route. Never throws.
  const recordError = async (provider: AIProvider, model: string, errorMessage: string) => {
    if (!options.quota) return;
    await recordUsage({
      userId: options.quota.userId,
      provider,
      model,
      route: options.quota.route,
      inputTokens: estimateTokens(systemPrompt) + estimateTokens(userPrompt),
      outputTokens: 0,
      latencyMs: Date.now() - callStartedAt,
      status: "error",
      errorMessage: errorMessage.slice(0, 500),
    }).catch(() => {});
  };

  const groqModel = options.model || "llama-3.1-8b-instant";

  // Groq exhausted — optionally try Gemini.
  if (!options.skipFallback) {
    try {
      const text = await generateWithGeminiFallback(systemPrompt, userPrompt, options);
      // Log Gemini success so fallback rates are visible in the dashboard.
      // Tokens are estimated since Gemini doesn't return a usage block.
      if (options.quota) {
        await recordUsage({
          userId: options.quota.userId,
          provider: "gemini",
          model: "gemini-2.0-flash",
          route: options.quota.route,
          inputTokens: estimateTokens(systemPrompt) + estimateTokens(userPrompt),
          outputTokens: estimateTokens(text),
          latencyMs: Date.now() - callStartedAt,
          status: "ok",
        }).catch(() => {});
      }
      return {
        text,
        provider: "gemini",
        attempts,
        totalLatencyMs: Date.now() - callStartedAt,
      };
    } catch (geminiErr) {
      // Both providers failed — log both as error rows then rethrow.
      const groqErrMsg = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
      const geminiErrMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      await recordError("groq", groqModel, groqErrMsg);
      await recordError("gemini", "gemini-2.0-flash", geminiErrMsg);

      if (rateLimited) {
        const retryAfter = lastRateLimitRetryAfter || Math.ceil(RATE_LIMIT_BACKOFF_MS[MAX_RETRIES - 1] / 1000);
        const msg = `AI providers exhausted (groq rate-limited, gemini failed: ${geminiErrMsg})`;
        throw new AIRateLimitError(msg, retryAfter);
      }
      if (lastError) throw lastError;
      throw geminiErr;
    }
  }

  // Fallback skipped — if rate-limited, throw typed error; else rethrow last.
  const groqErrMsg = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
  await recordError("groq", groqModel, groqErrMsg);
  if (rateLimited) {
    const retryAfter = lastRateLimitRetryAfter || Math.ceil(RATE_LIMIT_BACKOFF_MS[MAX_RETRIES - 1] / 1000);
    throw new AIRateLimitError("Groq rate limit exhausted (fallback disabled)", retryAfter);
  }
  throw lastError instanceof Error ? lastError : new Error("Groq call failed");
}

/**
 * Gemini fallback for `generateWithGroq`. Inlined here (not a separate
 * provider router) so every existing agent gets fail-over for free.
 * Throws when no Gemini key is configured.
 */
async function generateWithGeminiFallback(
  systemPrompt: string,
  userPrompt: string,
  options: GroqOptions = {},
): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    throw new Error("Gemini fallback not configured (set GEMINI_API_KEY)");
  }

  // Dynamic import so the @google/generative-ai dep stays optional.
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 800,
    },
    systemInstruction: systemPrompt,
  });

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    // @google/generative-ai supports per-call AbortSignal via the second arg.
    // Aborting cancels the underlying fetch instead of leaking it (the prior
    // Promise.race kept the request alive past the timeout deadline).
    const result = await model.generateContent(userPrompt, {
      signal: controller.signal,
    } as { signal: AbortSignal });
    const text = result.response.text();
    if (!text) throw new Error("Gemini returned empty response");

    await logApiCall("gemini").catch(() => {});
    return text;
  } catch (err) {
    if (timedOut) {
      throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
