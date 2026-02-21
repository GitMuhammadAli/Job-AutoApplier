/**
 * Lightweight Groq API wrapper for AI text generation with retry/backoff.
 */

import { TIMEOUTS } from "./constants";

interface GroqOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

const MAX_RETRIES = 2;

export async function generateWithGroq(
  systemPrompt: string,
  userPrompt: string,
  options: GroqOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUTS.AI_TIMEOUT_MS);

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

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, 10000) || 3000
          : 3000 * (attempt + 1);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error("AI rate limited. Please wait a moment and try again.");
      }

      if (response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        throw new Error(`AI service error (${response.status}). Try again.`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("AI returned an empty response. Please try again.");

      return text;
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error("AI request timed out. Please try again.");
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("AI generation failed. Please try again.");
}
