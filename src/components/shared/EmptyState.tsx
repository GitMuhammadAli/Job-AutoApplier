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
      <div className="rounded-full bg-slate-100 p-3 mb-3">
        <Inbox className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 max-w-[180px]">{description}</p>
      {actionLabel && actionHref && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3 rounded-lg text-xs"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
