/**
 * Sentry edge runtime config — middleware + edge route handlers.
 * Smaller surface than server config because most error paths land
 * in the Node runtime, not edge. Active when SENTRY_DSN is set.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
