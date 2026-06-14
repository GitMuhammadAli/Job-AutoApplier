"use client";

/**
 * Cookie consent banner — minimal, warm, GDPR-compatible.
 *
 * Behavior:
 *  - Renders only when user has not yet made a choice (persistent in
 *    localStorage under JP_COOKIE_CONSENT_KEY).
 *  - 3 actions: Accept all / Reject non-essential / Settings (link to /privacy).
 *  - Gates Sentry init via a custom event `jp:consent` that consumer code
 *    (sentry.client.config.ts, etc.) listens for.
 *  - Respects prefers-reduced-motion.
 *  - Slides up from bottom on first paint with the warm `slide-up` keyframe
 *    defined in tailwind.config.
 */

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "jp-cookie-consent-v1";

export type ConsentChoice = "all" | "essential-only";

type StoredConsent = {
  choice: ConsentChoice;
  decidedAt: string; // ISO date
  version: 1;
};

function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed && parsed.version === 1 && (parsed.choice === "all" || parsed.choice === "essential-only")) {
      return parsed;
    }
  } catch {
    // ignore — invalid stored state, treat as no choice
  }
  return null;
}

function writeStoredConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  const payload: StoredConsent = {
    choice,
    decidedAt: new Date().toISOString(),
    version: 1,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be disabled — fall through
  }
  // Emit a window event so Sentry init + future analytics can react.
  try {
    window.dispatchEvent(
      new CustomEvent("jp:consent", { detail: { choice } }),
    );
  } catch {
    // ignore
  }
}

/**
 * Check current consent from anywhere (e.g. before init'ing Sentry).
 * Returns null if user hasn't decided yet.
 */
export function getConsent(): ConsentChoice | null {
  return readStoredConsent()?.choice ?? null;
}

/**
 * Whether non-essential cookies/telemetry are allowed.
 * Use to gate Sentry, analytics, etc.
 */
export function isNonEssentialAllowed(): boolean {
  return getConsent() === "all";
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only render if no decision yet
    if (readStoredConsent() === null) {
      // Defer one frame so the slide-up animation actually plays
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, []);

  const handleChoice = useCallback((choice: ConsentChoice) => {
    writeStoredConsent(choice);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-detail"
      className="fixed bottom-0 left-0 right-0 z-[80] p-4 md:bottom-6 md:left-6 md:right-auto md:max-w-md"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="animate-slide-up rounded-2xl border border-stone-200 bg-white p-5 shadow-soft-lg dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="cookie-consent-title"
              className="font-display text-base text-stone-900 dark:text-stone-50"
            >
              A note about cookies
            </h2>
            <p
              id="cookie-consent-detail"
              className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300"
            >
              JobPilot uses essential cookies for sign-in. Optional telemetry
              (Sentry error monitoring) helps us find bugs you experience. Your
              choice is remembered — change it anytime in{" "}
              <a
                href="/settings"
                className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
              >
                Settings
              </a>
              .
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleChoice("all")}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-soft-sm transition-all duration-fast ease-soft-out hover:bg-emerald-700 hover:shadow-soft-md focus:outline-none focus:shadow-focus-emerald"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => handleChoice("essential-only")}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-800 transition-colors duration-fast hover:bg-stone-100 focus:outline-none focus:shadow-focus-emerald dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
              >
                Essential only
              </button>
              <a
                href="/privacy"
                className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-stone-600 transition-colors duration-fast hover:text-stone-900 focus:outline-none focus:shadow-focus-emerald dark:text-stone-400 dark:hover:text-stone-100"
              >
                Learn more
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleChoice("essential-only")}
            className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:text-stone-700 focus:outline-none focus:shadow-focus-emerald dark:hover:text-stone-200"
            aria-label="Dismiss — essential cookies only"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
