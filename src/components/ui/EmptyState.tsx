import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type EmptyStateAction = {
  label: string
  onClick?: () => void
  href?: string
}

export type EmptyStateProps = {
  title: string
  description: string
  /** Required — every empty state must offer at least one action. */
  action: EmptyStateAction
  secondaryAction?: EmptyStateAction
  icon?: React.ReactNode
  className?: string
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction
  variant: "primary" | "ghost"
}) {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4"
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
      : "text-zinc-700 hover:bg-zinc-100"

  if (action.href) {
    return (
      <Link href={action.href} className={cn(base, styles)}>
        {action.label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={action.onClick} className={cn(base, styles)}>
      {action.label}
    </button>
  )
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-16 w-16 items-center justify-center text-zinc-300 [&_svg]:h-full [&_svg]:w-full [&_svg]:stroke-[1.5]">
          {icon}
        </div>
      ) : null}

      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>

      <p
        className="mt-1 max-w-sm text-sm text-zinc-600"
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        {description}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <ActionButton action={action} variant="primary" />
        {secondaryAction ? (
          <ActionButton action={secondaryAction} variant="ghost" />
        ) : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Preset variants                               */
/* -------------------------------------------------------------------------- */

export function NoApplicationsYet(
  props: Partial<Omit<EmptyStateProps, "title" | "description" | "action">> & {
    action?: EmptyStateAction
  }
) {
  const { action, ...rest } = props
  return (
    <EmptyState
      title="No applications yet"
      description="Start tracking your job search. Pick a role from your recommendations to file your first application."
      action={action ?? { label: "Find your first job →", href: "/recommended" }}
      {...rest}
    />
  )
}

export function NoResumeUploaded(
  props: Partial<
    Omit<EmptyStateProps, "title" | "description" | "action" | "secondaryAction">
  > & {
    action?: EmptyStateAction
    secondaryAction?: EmptyStateAction
  }
) {
  const { action, secondaryAction, ...rest } = props
  return (
    <EmptyState
      title="Add a resume to begin"
      description="Upload a PDF or fill the form manually. Your resume powers tailored applications and matches."
      action={action ?? { label: "Upload PDF →", href: "/resumes/upload" }}
      secondaryAction={
        secondaryAction ?? { label: "Fill manually →", href: "/resumes/new" }
      }
      {...rest}
    />
  )
}

export function NoFollowUpsNeeded(
  props: Partial<Omit<EmptyStateProps, "title" | "description" | "action">> & {
    action?: EmptyStateAction
  }
) {
  const { action, ...rest } = props
  return (
    <EmptyState
      title="Nothing to follow up on yet"
      description="Once you apply, follow-up reminders will show up here so nothing slips through the cracks."
      action={action ?? { label: "Send your first apply →", href: "/recommended" }}
      {...rest}
    />
  )
}

export default EmptyState
