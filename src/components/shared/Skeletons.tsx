import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/70",
        className
      )}
    />
  );
}

export function KanbanSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-36" />
        <Bone className="h-5 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="space-y-2.5">
            <Bone className="h-8 w-full rounded-xl" />
            {Array.from({ length: 2 + (col % 2) }).map((_, row) => (
              <Bone key={row} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Bone className="h-64 rounded-xl" />
        <Bone className="h-64 rounded-xl" />
      </div>
      <Bone className="h-48 rounded-xl" />
    </div>
  );
}

export function ApplicationsSkeleton() {
  return (
    <div className="space-y-4">
      <Bone className="h-10 w-full rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function JobDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Bone className="h-5 w-32" />
      <Bone className="h-40 rounded-xl" />
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      <Bone className="h-16 rounded-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Bone key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}
