"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type Phase = {
  id: string
  label: string
  subLabel?: string
}

export interface ProgressPhasesProps {
  phases: Phase[]
  currentPhase: number
  estimatedSecondsRemaining?: number
  allowLeave?: boolean
  className?: string
}

/**
 * Inject keyframes once per page for the dot pulse and slim indeterminate bar.
 * Using CSS only (no Framer Motion). 150ms ease-out per spec.
 */
const STYLE_ID = "progress-phases-keyframes"
const KEYFRAMES = `
@keyframes progressPhasesPulse {
  0%   { transform: scale(1);   opacity: 1;   }
  50%  { transform: scale(1.25); opacity: 0.6; }
  100% { transform: scale(1);   opacity: 1;   }
}
@keyframes progressPhasesSlide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%);  }
}
`

function useInjectKeyframes() {
  React.useEffect(() => {
    if (typeof document === "undefined") return
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = KEYFRAMES
    document.head.appendChild(style)
  }, [])
}

export function ProgressPhases({
  phases,
  currentPhase,
  estimatedSecondsRemaining,
  allowLeave,
  className,
}: ProgressPhasesProps) {
  useInjectKeyframes()

  const safeIndex = Math.max(0, Math.min(currentPhase, phases.length - 1))
  const current = phases[safeIndex]

  const estimatedText =
    typeof estimatedSecondsRemaining === "number"
      ? estimatedSecondsRemaining < 5
        ? "Almost done"
        : `Estimated: ${Math.round(estimatedSecondsRemaining)} seconds remaining`
      : null

  return (
    <div
      className={cn(
        "w-full",
        // 150ms ease-out applied to interactive state changes
        "[&_*]:transition-[background-color,border-color,color,transform,opacity] [&_*]:duration-150 [&_*]:ease-out",
        className
      )}
      role="group"
      aria-label="Progress phases"
    >
      {/* Indicator: horizontal on sm+, vertical stack on mobile */}
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
        {phases.map((phase, i) => {
          const isCompleted = i < safeIndex
          const isCurrent = i === safeIndex
          const isLast = i === phases.length - 1

          return (
            <li
              key={phase.id}
              className={cn(
                "flex items-center sm:flex-1 sm:flex-col",
                !isLast && "sm:items-stretch"
              )}
            >
              {/* Dot + connector row */}
              <div className="flex items-center sm:w-full">
                <Dot completed={isCompleted} current={isCurrent} />
                {/* Connector line: horizontal on sm+, hidden on mobile (we use vertical stack) */}
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      "hidden sm:block h-px flex-1 mx-2",
                      isCompleted ? "bg-emerald-600" : "bg-zinc-200"
                    )}
                  />
                )}
                {/* Mobile: label sits to the right of the dot */}
                <div className="ml-3 sm:hidden">
                  <PhaseLabel phase={phase} isCurrent={isCurrent} />
                </div>
              </div>

              {/* Desktop label below the dot */}
              <div className="hidden sm:block mt-2 text-center">
                <PhaseLabel phase={phase} isCurrent={isCurrent} />
              </div>
            </li>
          )
        })}
      </ol>

      {/* Current phase detail */}
      {current && (
        <div className="mt-5 space-y-1">
          <p className="text-sm text-zinc-900">
            Currently: <span className="font-medium">{current.label}</span>
            {current.subLabel ? (
              <span className="text-zinc-500"> — {current.subLabel}</span>
            ) : null}
          </p>
          {estimatedText && (
            <p className="text-xs text-zinc-500">{estimatedText}</p>
          )}
          {allowLeave && (
            <p className="text-xs text-zinc-400">
              You can leave this page — we&apos;ll save the result.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Dot({
  completed,
  current,
}: {
  completed: boolean
  current: boolean
}) {
  if (completed) {
    return (
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full bg-emerald-600 ring-0 shrink-0"
      />
    )
  }
  if (current) {
    return (
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full bg-emerald-600 shrink-0"
        style={{
          animation: "progressPhasesPulse 150ms ease-out infinite",
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 rounded-full border-2 border-zinc-300 bg-transparent shrink-0"
    />
  )
}

function PhaseLabel({
  phase,
  isCurrent,
}: {
  phase: Phase
  isCurrent: boolean
}) {
  return (
    <span
      className={cn(
        "block leading-tight",
        isCurrent ? "text-sm text-zinc-900 font-medium" : "text-xs text-zinc-400"
      )}
    >
      {phase.label}
    </span>
  )
}

/**
 * SimpleProgress — slim indeterminate emerald bar for cases without
 * named phases. CSS animation only, ~1.2s slide loop.
 */
export function SimpleProgress({ className }: { className?: string }) {
  useInjectKeyframes()
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-full bg-emerald-100",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1/3 bg-emerald-600 rounded-full"
        style={{
          animation: "progressPhasesSlide 1200ms ease-out infinite",
        }}
      />
    </div>
  )
}

export default ProgressPhases
