/**
 * Centralized error capture wrapper.
 *
 * Replaces scattered `console.error` calls in catch blocks. Routes everything
 * through Sentry (when available + user has consented to non-essential
 * telemetry) AND a structured console.error fallback for local dev.
 *
 * Designed to be safe-to-call from server and client code. Sentry SDK is
 * imported lazily so this file doesn't bloat bundles that don't use it.
 *
 * Usage:
 *   try {
 *     await sendApplication(id);
 *   } catch (err) {
 *     captureError(err, {
 *       route: "/api/applications/[id]/send",
 *       userId,
 *       extras: { applicationId: id, mode },
 *     });
 *     return Response.json({ error: "..." }, { status: 500 });
 *   }
 *
 * Use captureMessage for non-error notable events:
 *   captureMessage("Auto-apply quota soft-cap exceeded", { userId, ... });
 */

type SentryLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

type CaptureContext = {
  /** Route or operation name. e.g. `/api/resumes/generate` or `cron:check-followups`. */
  route?: string;
  /** Authenticated user ID, if known. Becomes `user.id` in Sentry. */
  userId?: string;
  /** Free-form fingerprint hint — keep this small and stable, no IDs. */
  fingerprint?: string[];
  /** Tags become searchable filters in Sentry. */
  tags?: Record<string, string>;
  /** Extras become attached context (full event payload). */
  extras?: Record<string, unknown>;
  /** Override severity. Defaults to "error". */
  level?: SentryLevel;
};

type SentryLike = {
  captureException: (err: unknown, hint?: unknown) => string | undefined;
  captureMessage: (msg: string, hint?: unknown) => string | undefined;
  withScope: (cb: (scope: SentryScope) => void) => void;
};

type SentryScope = {
  setUser: (user: { id?: string; email?: string } | null) => void;
  setTag: (key: string, value: string) => void;
  setExtra: (key: string, value: unknown) => void;
  setLevel: (level: SentryLevel) => void;
  setFingerprint: (fingerprint: string[]) => void;
};

let cachedSentry: SentryLike | null | undefined;

/**
 * Lazy-load Sentry. Returns null if not installed or DSN not set.
 * Cached after first call so repeated captures are cheap.
 */
async function getSentry(): Promise<SentryLike | null> {
  if (cachedSentry !== undefined) return cachedSentry;

  // No DSN = Sentry is off (matches sentry.client.config.ts gating)
  const dsn =
    (typeof process !== "undefined" &&
      (process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN)) ||
    null;

  if (!dsn) {
    cachedSentry = null;
    return null;
  }

  try {
    // Dynamic import keeps this out of bundles that don't reach a capture call.
    const mod = (await import("@sentry/nextjs")) as unknown as SentryLike;
    cachedSentry = mod;
    return mod;
  } catch {
    cachedSentry = null;
    return null;
  }
}

/**
 * Check whether the user has opted in to non-essential telemetry.
 * Client-side: reads localStorage written by CookieConsent.
 * Server-side: defaults to true (no per-request consent state available
 * cheaply; Sentry's own server-side capture is acceptable under legitimate
 * interest provided privacy policy discloses it).
 */
function consentAllowsTelemetry(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem("jp-cookie-consent-v1");
    if (!raw) return false; // no decision yet — default to NO
    const parsed = JSON.parse(raw) as { choice?: string };
    return parsed.choice === "all";
  } catch {
    return false;
  }
}

function logToConsole(
  kind: "error" | "message",
  payload: unknown,
  ctx: CaptureContext,
  errorObj?: unknown,
) {
  // Always log to console — even when Sentry takes the event, this aids
  // local dev and Vercel function logs. Structured for easy grepping.
  const tag = ctx.route ?? "unknown";
  const userTag = ctx.userId ? `user=${ctx.userId.slice(0, 8)}…` : "anon";
  const prefix = `[${kind === "error" ? "captureError" : "captureMessage"}][${tag}][${userTag}]`;
  if (kind === "error") {
    // eslint-disable-next-line no-console
    console.error(prefix, payload, ctx.extras ?? {});
  } else {
    // eslint-disable-next-line no-console
    console.warn(prefix, payload, ctx.extras ?? {});
    void errorObj;
  }
}

/**
 * Capture an error. Always fire-and-forget — never throws.
 * Returns Sentry event ID when available, otherwise null.
 */
export function captureError(
  err: unknown,
  ctx: CaptureContext = {},
): Promise<string | null> {
  // Log to console immediately (sync) regardless of Sentry
  logToConsole("error", err, ctx);

  // Then enrich + forward to Sentry async
  return (async () => {
    try {
      if (!consentAllowsTelemetry()) return null;
      const sentry = await getSentry();
      if (!sentry) return null;

      let eventId: string | undefined;
      sentry.withScope((scope) => {
        if (ctx.userId) scope.setUser({ id: ctx.userId });
        if (ctx.route) scope.setTag("route", ctx.route);
        if (ctx.tags) {
          for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
        }
        if (ctx.extras) {
          for (const [k, v] of Object.entries(ctx.extras)) scope.setExtra(k, v);
        }
        if (ctx.level) scope.setLevel(ctx.level);
        if (ctx.fingerprint) scope.setFingerprint(ctx.fingerprint);
        eventId = sentry.captureException(err);
      });
      return eventId ?? null;
    } catch {
      return null;
    }
  })();
}

/**
 * Capture a non-error notable event (e.g. quota soft-cap exceeded,
 * fallback chain used, auto-rollback triggered).
 */
export function captureMessage(
  msg: string,
  ctx: CaptureContext = {},
): Promise<string | null> {
  logToConsole("message", msg, ctx);

  return (async () => {
    try {
      if (!consentAllowsTelemetry()) return null;
      const sentry = await getSentry();
      if (!sentry) return null;

      let eventId: string | undefined;
      sentry.withScope((scope) => {
        if (ctx.userId) scope.setUser({ id: ctx.userId });
        if (ctx.route) scope.setTag("route", ctx.route);
        if (ctx.tags) {
          for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
        }
        if (ctx.extras) {
          for (const [k, v] of Object.entries(ctx.extras)) scope.setExtra(k, v);
        }
        scope.setLevel(ctx.level ?? "info");
        if (ctx.fingerprint) scope.setFingerprint(ctx.fingerprint);
        eventId = sentry.captureMessage(msg);
      });
      return eventId ?? null;
    } catch {
      return null;
    }
  })();
}

/**
 * Wrap an async route handler. Catches anything that escapes the inner fn,
 * captures to Sentry with the context, then re-throws so the framework's
 * own error response kicks in. Use sparingly — most catches should be
 * explicit + offer the user an ErrorPanel.
 *
 * Usage:
 *   export const POST = withCapture(
 *     { route: "/api/resumes/generate" },
 *     async (req: NextRequest) => { ... }
 *   );
 */
export function withCapture<TArgs extends unknown[], TResult>(
  baseCtx: Omit<CaptureContext, "extras">,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      await captureError(err, baseCtx);
      throw err;
    }
  };
}

/**
 * Mark all subsequent captures in this scope as belonging to a particular
 * release. Wires `release` automatically based on VERCEL_GIT_COMMIT_SHA when
 * present, falling back to commit hash from env.
 *
 * Call once at module-init time in instrumentation.ts.
 */
export function getReleaseTag(): string {
  if (typeof process === "undefined") return "unknown";
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.COMMIT_SHA ??
    "local"
  );
}
