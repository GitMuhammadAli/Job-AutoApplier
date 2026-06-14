"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SavedIndicatorProps {
  state: SaveState;
  lastSavedAt?: Date;
  onRetry?: () => void;
}

function formatRelativeTime(from: Date, now: Date): string {
  const diffMs = now.getTime() - from.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function SavedIndicator({
  state,
  lastSavedAt,
  onRetry,
}: SavedIndicatorProps) {
  // Tick every 5s to refresh the relative time label while mounted.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (state !== "saved" || !lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [state, lastSavedAt]);

  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400"
        aria-live="polite"
      >
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400"
          aria-hidden="true"
        />
        Saving
      </span>
    );
  }

  if (state === "saved") {
    const label = lastSavedAt
      ? `Saved ${formatRelativeTime(lastSavedAt, new Date())}`
      : "Saved";
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-zinc-400"
        aria-live="polite"
      >
        <span aria-hidden="true">✓</span>
        {label}
      </span>
    );
  }

  // error
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-zinc-400"
      aria-live="polite"
      role="status"
    >
      <span className="text-amber-400" aria-hidden="true">
        ⚠
      </span>
      <span>Save failed</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 rounded px-1.5 py-0.5 text-xs text-zinc-300 underline-offset-2 hover:text-zinc-100 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
        >
          Retry
        </button>
      ) : null}
    </span>
  );
}

export interface UseSaveStateResult<TArgs extends unknown[], TResult> {
  state: SaveState;
  lastSavedAt?: Date;
  error?: Error;
  trigger: (...args: TArgs) => Promise<TResult | undefined>;
}

/**
 * Wraps an async save function and tracks its lifecycle state.
 *
 * Usage:
 *   const { state, lastSavedAt, trigger } = useSaveState(async (data) => {
 *     await api.save(data);
 *   });
 */
export function useSaveState<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): UseSaveStateResult<TArgs, TResult> {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Keep latest fn in a ref so trigger identity stays stable.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // Guard against state updates after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const trigger = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setState("saving");
      setError(undefined);
      try {
        const result = await fnRef.current(...args);
        if (mountedRef.current) {
          setLastSavedAt(new Date());
          setState("saved");
        }
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (mountedRef.current) {
          setError(err);
          setState("error");
        }
        return undefined;
      }
    },
    [],
  );

  return { state, lastSavedAt, error, trigger };
}

export default SavedIndicator;
