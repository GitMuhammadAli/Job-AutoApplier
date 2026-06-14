/**
 * Error registry — single source of truth for user-facing error messages.
 *
 * Why this file exists:
 *   Every surface (API route, agent, component) that needs to show a
 *   structured error pulls from here. No raw error strings in JSX.
 *   Codes are stable identifiers used in logs + analytics; titles and
 *   details are what the user reads.
 *
 * Adding a new error:
 *   1. Add a key to ERROR_REGISTRY with title/detail/actions
 *   2. Use {N}, {terms}, {time} placeholders for runtime values
 *   3. Call buildErrorPayload('YOUR_CODE', { detail, actions }) at the call site
 */

export type ErrorAction = {
  type: 'retry' | 'link' | 'fallback' | 'contact';
  label: string;
  href?: string;
  /** Seconds until auto-retry fires. Component shows a countdown. */
  autoRetryIn?: number;
};

export type ErrorPayload = {
  code: string;
  title: string;
  detail: string;
  actions: ErrorAction[];
};

export const ERROR_REGISTRY: Record<string, Omit<ErrorPayload, 'code'>> = {
  AI_RATE_LIMITED: {
    title: 'Our AI is rate-limited',
    detail: "Groq lets us make 30 requests/minute. We'll retry in {N}s.",
    actions: [
      { type: 'retry', label: 'Retrying...', autoRetryIn: 30 },
      { type: 'fallback', label: 'Use Gemini now' },
    ],
  },
  ALL_UPLOADS_FAILED: {
    title: "We couldn't read any of your uploaded resumes",
    detail:
      'Your 3 most recent PDFs failed to parse. Fastest fix: fill your profile manually (2 min).',
    actions: [
      { type: 'link', label: 'Open My Profile', href: '/resumes' },
      { type: 'retry', label: 'Try again' },
    ],
  },
  NO_PROFILE_OR_UPLOADS: {
    title: "Let's set up your profile",
    detail:
      'Fill your details manually (2 min) or upload an existing resume PDF.',
    actions: [
      { type: 'link', label: 'Fill profile', href: '/resumes' },
      { type: 'link', label: 'Upload PDF', href: '/resumes#upload' },
    ],
  },
  AUDIT_FAIL: {
    title: "We caught the AI adding {N} things you don't have",
    detail:
      'Fabricated terms: {terms}. Add them to your profile if real, or retry.',
    actions: [
      { type: 'link', label: 'Open profile', href: '/resumes' },
      { type: 'retry', label: 'Regenerate' },
    ],
  },
  TEMPLATE_NOT_AVAILABLE: {
    title: "That template isn't ready yet",
    detail: 'Pick another — T01 (ATS Clean) is safest.',
    actions: [{ type: 'link', label: 'Use T01', href: '?template=T01' }],
  },
  AI_QUOTA_EXCEEDED: {
    title: "You've hit today's AI limit",
    detail: 'Resets at {time}.',
    actions: [{ type: 'link', label: 'See quota', href: '/settings' }],
  },
  NETWORK_ERROR: {
    title: 'Connection lost',
    detail: 'Check your internet, then retry.',
    actions: [{ type: 'retry', label: 'Retry' }],
  },
  UNKNOWN: {
    title: 'Something went wrong',
    detail: "We've been notified. If urgent, contact support.",
    actions: [{ type: 'contact', label: 'Email support' }],
  },
};

/**
 * Interpolates {placeholder} tokens in a string using the provided values.
 * Unknown placeholders are left as-is so they're visible in dev.
 */
function interpolate(
  template: string,
  values: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = values[key];
    return v === undefined || v === null ? match : String(v);
  });
}

/**
 * Build a fully-resolved ErrorPayload from a registry code.
 *
 * - Looks up `code` in ERROR_REGISTRY; falls back to UNKNOWN if missing.
 * - Interpolates {N}, {terms}, {time} (and any other token) inside `detail`
 *   from `overrides.detail` when provided as a Record-like map, OR from a
 *   raw override string when the caller wants to replace the whole detail.
 * - Merges actions: any `overrides.actions` fully replaces the registry list
 *   (the caller is opting into a custom action set). To extend instead of
 *   replace, spread the registry actions explicitly at the call site.
 *
 * The second argument also accepts a `values` field as a convenience for
 * the common case of just supplying interpolation values without touching
 * the rest of the payload.
 */
export function buildErrorPayload(
  code: string,
  overrides?: Partial<ErrorPayload> & {
    values?: Record<string, string | number | undefined>;
  },
): ErrorPayload {
  const base = ERROR_REGISTRY[code] ?? ERROR_REGISTRY.UNKNOWN;
  const resolvedCode = ERROR_REGISTRY[code] ? code : 'UNKNOWN';

  const values = overrides?.values ?? {};

  const title = overrides?.title
    ? interpolate(overrides.title, values)
    : interpolate(base.title, values);

  const detail = overrides?.detail
    ? interpolate(overrides.detail, values)
    : interpolate(base.detail, values);

  const actions = overrides?.actions ?? base.actions;

  return {
    code: resolvedCode,
    title,
    detail,
    actions,
  };
}
