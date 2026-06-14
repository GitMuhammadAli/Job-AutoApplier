/**
 * Next.js instrumentation hook — runs once when the server boots.
 *
 * Wires Sentry on the server runtime and on the edge runtime. Tags the
 * release with VERCEL_GIT_COMMIT_SHA so issues group by deploy.
 *
 * Note: client-side Sentry is initialized via sentry.client.config.ts
 * (also gated by cookie consent — see CookieConsent component).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");

    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return; // no-op when DSN unset (local dev)

    Sentry.init({
      dsn,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      release:
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
        process.env.COMMIT_SHA ??
        "local",
      environment:
        process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      // Strip headers that may leak credentials
      beforeSend(event) {
        if (event.request?.headers) {
          delete (event.request.headers as Record<string, string>).cookie;
          delete (event.request.headers as Record<string, string>).authorization;
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");

    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    Sentry.init({
      dsn,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      release:
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
        "local",
      environment:
        process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    });
  }
}

/**
 * Capture errors that escape Server Components / Server Actions.
 * Available in Next 15+ — safely no-ops if not supported.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  } catch {
    // Sentry not installed or older API — fallback no-op
  }
}
