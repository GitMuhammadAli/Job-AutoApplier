/**
 * Sentry client (browser) config.
 *
 * Activates only when NEXT_PUBLIC_SENTRY_DSN is set. Without it, every
 * Sentry.init reads the missing DSN and the SDK silently no-ops, which
 * is exactly what we want for local dev + smoke-test runs.
 *
 * To enable in prod:
 *   1. Create a Sentry project at sentry.io (free tier — 5k events/mo
 *      browser + 10k server, plenty for solo use).
 *   2. Copy the DSN.
 *   3. Add NEXT_PUBLIC_SENTRY_DSN to Vercel env vars (production + preview).
 *   4. Add SENTRY_DSN (same value) for server-side init.
 *   5. Re-deploy. Errors start landing in Sentry within ~30 sec.
 *
 * Cost control: tracesSampleRate set to 0.1 (10% of transactions get
 * a perf trace). At Anthropic's typical solo-project volume that's
 * well under the free-tier 10k spans/month cap.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    // Ignore the noisy errors we can't fix (third-party, browser quirks).
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection captured",
      "Network request failed",
      "Failed to fetch",
    ],
  });
}
