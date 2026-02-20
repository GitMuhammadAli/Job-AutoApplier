/**
 * Lightweight Groq API wrapper for AI text generation with retry/backoff.
 */

interface GroqOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

const MAX_RETRIES = 3;

export async function generateWithGroq(
  systemPrompt: string,
  userPrompt: string,
  options: GroqOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000 || 3000
          : 2000 * Math.pow(2, attempt);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error: ${err}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response from Groq");

      return text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error("Groq API failed after retries");
}
