"use client";

/**
 * Accessible progress bar primitive.
 *
 * The existing ProgressPhases component renders animated dots but the
 * audit found two issues: (1) no role="progressbar" / aria-valuenow, so
 * screen readers don't announce progress, and (2) the indeterminate state
 * uses CSS-only animation that screen readers can't track.
 *
 * This primitive wraps the visual variant with the correct ARIA shape.
 * Defaults to determinate; pass `indeterminate` for unknown-length work.
 *
 * Aesthetic: warm stone, slow easing — matches tokens.css.
 */

import * as React from "react";

interface Props {
  /** 0–100. Ignored when indeterminate. */
  value?: number;
  /** Accessible label, e.g. "Generating your tailored resume". */
  label: string;
  /** When true, renders a streaming indeterminate bar. */
  indeterminate?: boolean;
  className?: string;
}

export function ProgressBar({ value, label, indeterminate = false, className }: Props) {
  const safeValue = indeterminate
    ? undefined
    : typeof value === "number"
      ? Math.max(0, Math.min(100, value))
      : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      aria-valuetext={indeterminate ? "In progress" : `${safeValue}%`}
      className={
        "relative h-1.5 w-full overflow-hidden rounded-full bg-stone-200/70 " +
        (className ?? "")
      }
    >
      <div
        className={
          indeterminate
            ? "absolute inset-y-0 left-0 w-1/3 rounded-full bg-emerald-500/80 animate-progress-indeterminate"
            : "h-full rounded-full bg-emerald-500/80 transition-[width] duration-500 ease-out"
        }
        style={!indeterminate && typeof safeValue === "number" ? { width: `${safeValue}%` } : undefined}
      />
    </div>
  );
}
