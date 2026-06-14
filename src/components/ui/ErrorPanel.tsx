'use client';

/**
 * ErrorPanel — compact, surface-light card for structured user-facing errors.
 *
 * Pairs with src/lib/errors/registry.ts. Pass it a built ErrorPayload and it
 * renders title, detail, action buttons, and an auto-retry countdown when an
 * action specifies `autoRetryIn`.
 *
 * Typography classes (font-display, font-body, font-mono) map to the CSS
 * variables defined in src/styles/tokens.ts via tailwind.config (the
 * fontFamily theme extension reads --font-display etc.). Colors stay on the
 * default Tailwind zinc/emerald scale to match the rest of the dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Mail,
  RefreshCw,
  Zap,
} from 'lucide-react';

import type { ErrorAction, ErrorPayload } from '@/lib/errors/registry';

export type ErrorPanelProps = {
  payload: ErrorPayload;
  /** Called when a retry-type action button is clicked OR auto-retry fires. */
  onRetry?: () => void;
  /** Called when a fallback-type action button is clicked. */
  onFallback?: () => void;
  /** Override the timestamp shown next to the error code. Defaults to now. */
  timestamp?: Date;
  className?: string;
};

function formatTimestamp(d: Date): string {
  // Hard-code a stable, short representation: HH:MM TZ.
  // toLocaleTimeString picks up the user's locale + system tz abbreviation.
  return d
    .toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      hour12: false,
    })
    .replace(',', '');
}

function actionIcon(type: ErrorAction['type']) {
  switch (type) {
    case 'retry':
      return <RefreshCw className="h-3.5 w-3.5" aria-hidden />;
    case 'fallback':
      return <Zap className="h-3.5 w-3.5" aria-hidden />;
    case 'link':
      return <ExternalLink className="h-3.5 w-3.5" aria-hidden />;
    case 'contact':
      return <Mail className="h-3.5 w-3.5" aria-hidden />;
  }
}

type ButtonVariant = 'primary' | 'secondary';

function ActionButton({
  action,
  variant,
  onClick,
  countdown,
}: {
  action: ErrorAction;
  variant: ButtonVariant;
  onClick: () => void;
  countdown?: number;
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-body font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed';

  const styles =
    variant === 'primary'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
      : 'bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-200 active:bg-zinc-300';

  const label =
    countdown !== undefined && countdown > 0
      ? `${action.label} (${countdown}s)`
      : action.label;

  // Link-type actions render as <a>, everything else as <button>.
  if (action.type === 'link' && action.href) {
    return (
      <a
        href={action.href}
        className={`${base} ${styles}`}
        onClick={onClick}
      >
        {actionIcon(action.type)}
        <span>{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${styles}`}
    >
      {actionIcon(action.type)}
      <span>{label}</span>
    </button>
  );
}

export function ErrorPanel({
  payload,
  onRetry,
  onFallback,
  timestamp,
  className,
}: ErrorPanelProps) {
  const ts = useMemo(() => timestamp ?? new Date(), [timestamp]);
  const tsLabel = useMemo(() => formatTimestamp(ts), [ts]);

  // Find an auto-retry action, if any. Only one countdown is supported.
  const autoRetryAction = useMemo(
    () => payload.actions.find((a) => a.type === 'retry' && a.autoRetryIn),
    [payload.actions],
  );
  const initialCountdown = autoRetryAction?.autoRetryIn ?? 0;

  const [countdown, setCountdown] = useState<number>(initialCountdown);

  // Reset countdown whenever the payload's auto-retry seconds change
  // (new error, or same error with a different backoff).
  useEffect(() => {
    setCountdown(initialCountdown);
  }, [initialCountdown, payload.code]);

  useEffect(() => {
    if (!autoRetryAction || countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          // Fire onRetry on the tick that hits zero.
          onRetry?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // We intentionally depend on autoRetryAction + onRetry; countdown updates
    // are handled inside the interval via the functional setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRetryAction, onRetry, payload.code]);

  const handleAction = useCallback(
    (action: ErrorAction) => {
      if (action.type === 'retry') onRetry?.();
      else if (action.type === 'fallback') onFallback?.();
      else if (action.type === 'contact') {
        // Default contact behavior: open mailto. Override at call site if needed.
        window.location.href = 'mailto:support@jobapplier.app';
      }
      // Link-type actions are handled by the <a> tag's native href.
    },
    [onRetry, onFallback],
  );

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${
        className ?? ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"
          aria-hidden
        >
          <AlertCircle className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight text-zinc-900">
            {payload.title}
          </h3>
          <p className="mt-1 font-body text-sm leading-relaxed text-zinc-600">
            {payload.detail}
          </p>

          {payload.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.actions.map((action, idx) => {
                const variant: ButtonVariant = idx === 0 ? 'primary' : 'secondary';
                const isCountdownAction =
                  action === autoRetryAction && countdown > 0;
                return (
                  <ActionButton
                    key={`${action.type}-${action.label}-${idx}`}
                    action={action}
                    variant={variant}
                    onClick={() => handleAction(action)}
                    countdown={isCountdownAction ? countdown : undefined}
                  />
                );
              })}
            </div>
          )}

          <div className="mt-3 border-t border-zinc-100 pt-2">
            <span className="font-mono text-xs text-zinc-400">
              Error {payload.code} · {tsLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorPanel;
