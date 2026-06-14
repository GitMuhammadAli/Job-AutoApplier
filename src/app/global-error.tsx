"use client";

/**
 * Global error boundary — Next.js App Router.
 *
 * Catches anything that escapes the root layout. Captures to Sentry with
 * the user's consent honored, then renders the warm ErrorPanel.
 *
 * Next.js requires this file to define its own <html>/<body> since it
 * replaces the root layout when an error escapes the root.
 */

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { captureError } from "@/lib/observability/capture";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void captureError(error, {
      route: "global-error",
      tags: error.digest ? { digest: error.digest } : undefined,
      level: "fatal",
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12 text-stone-700 antialiased">
        <ErrorPanel
          payload={{
            code: "UNKNOWN",
            title: "Something broke on our end",
            detail:
              error.digest
                ? `An unexpected error occurred and we've been notified (id ${error.digest.slice(0, 8)}). Try again — if it persists, contact support.`
                : "An unexpected error occurred and we've been notified. Try again — if it persists, contact support.",
            actions: [
              { type: "retry", label: "Try again" },
              { type: "contact", label: "Email support" },
            ],
          }}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
