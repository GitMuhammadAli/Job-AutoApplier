"use client";

import { useState, useCallback } from "react";

export function useStreamingPitch() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (userJobId: string, type: "pitch" | "cover_letter") => {
      setIsStreaming(true);
      setText("");
      setError(null);

      try {
        const res = await fetch(`/api/jobs/generate-pitch?stream=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userJobId, type, stream: true }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((prev) => prev + decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate content";
        setError(message);
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setText("");
    setError(null);
  }, []);

  return { text, isStreaming, error, generate, reset };
}
