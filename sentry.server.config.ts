/**
 * Sentry server (Node runtime) config.
 *
 * Active when SENTRY_DSN env var is set. No-ops without it.
 * Covers route handlers, server components, server actions.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    // Don't capture POST/PUT request bodies — they contain user PII
    // (resume content, applied jobs, settings). Stack traces alone are
    // enough to debug 95% of issues.
    sendDefaultPii: false,
    // Filter out the user-data errors we've already humanised — these
    // are expected control flow, not bugs worth alerting on.
    ignoreErrors: [
      "Not authenticated",
      "Unauthorized",
      "Forbidden",
      "Already sent",
      "FabricationError",
    ],
  });
}
