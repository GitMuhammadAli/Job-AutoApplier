import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** Lucide icon — defaults to Inbox. Pass FileText, Briefcase, etc. for context. */
  icon?: LucideIcon;
  /** Layout tone — "default" = subtle (in-page), "card" = boxed (standalone container). */
  tone?: "default" | "card";
  /** Optional inline action click handler — used instead of href when provided. */
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon: Icon = Inbox,
  tone = "default",
}: EmptyStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 mb-3 ring-1 ring-slate-100 dark:ring-zinc-700">
        <Icon className="h-7 w-7 text-slate-300 dark:text-zinc-600" aria-hidden="true" />
      </div>
      <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{title}</h3>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500 max-w-[260px] leading-relaxed">
        {description}
      </p>
      {actionLabel && (actionHref || onAction) && (
        <div className="mt-3">
          {actionHref ? (
            <Button asChild variant="outline" size="sm" className="h-7 rounded-lg text-[11px] px-3">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button onClick={onAction} variant="outline" size="sm" className="h-7 rounded-lg text-[11px] px-3">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (tone === "card") {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        {content}
      </div>
    );
  }
  return content;
}
