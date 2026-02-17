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
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="rounded-xl bg-slate-50 p-2.5 mb-2 ring-1 ring-slate-100">
        <Inbox className="h-5 w-5 text-slate-300" />
      </div>
      <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
      <p className="mt-0.5 text-[10px] text-slate-400 max-w-[160px] leading-relaxed">{description}</p>
      {actionLabel && actionHref && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-2.5 h-7 rounded-lg text-[10px] px-3"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
