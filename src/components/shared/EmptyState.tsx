import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 mb-3 ring-1 ring-slate-100 dark:ring-zinc-700">
        <Inbox className="h-7 w-7 text-slate-300 dark:text-zinc-600" />
      </div>
      <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{title}</h3>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500 max-w-[200px] leading-relaxed">{description}</p>
      {actionLabel && actionHref && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3 h-7 rounded-lg text-[11px] px-3"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
