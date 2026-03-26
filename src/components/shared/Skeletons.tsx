import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-slate-200/70 via-slate-100/70 to-slate-200/70 dark:from-zinc-700/70 dark:via-zinc-600/70 dark:to-zinc-700/70 bg-[length:200%_100%] animate-shimmer",
        className
      )}
      style={{
        animation: "shimmer 1.5s ease-in-out infinite",
        backgroundSize: "200% 100%",
      }}
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

export function RecommendedJobsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-white dark:bg-zinc-800/50 p-3 ring-1 ring-slate-100 dark:ring-zinc-700/60">
        <div className="w-full sm:w-auto space-y-1.5">
          <Bone className="h-3 w-12" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Bone key={i} className="h-6 w-16 rounded-md" />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Bone className="h-3 w-10" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} className="h-6 w-12 rounded-md" />
            ))}
          </div>
        </div>
      </div>
      {/* Job cards grid skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-24" />
              <Bone className="h-5 w-10" />
            </div>
            <Bone className="h-5 w-3/4" />
            <div className="flex gap-1.5">
              <Bone className="h-5 w-16 rounded" />
              <Bone className="h-5 w-14 rounded" />
              <Bone className="h-5 w-18 rounded" />
            </div>
            <Bone className="h-1.5 w-full rounded-full" />
            <Bone className="h-3 w-2/3" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, j) => (
                <Bone key={j} className="h-5 w-14 rounded" />
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-zinc-700/50">
              <Bone className="h-3 w-24" />
              <Bone className="h-3 w-12" />
            </div>
            <div className="flex gap-1.5">
              <Bone className="h-6 w-16 rounded-md" />
              <Bone className="h-6 w-14 rounded-md" />
              <Bone className="h-6 w-16 rounded-md ml-auto" />
            </div>
          </div>
        ))}
      </div>
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

export function ResumesSkeleton() {
  return (
    <div className="space-y-4">
      <Bone className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Bone className="h-5 w-32" />
              <Bone className="h-5 w-16 rounded" />
            </div>
            <Bone className="h-3 w-48" />
            <div className="flex gap-2">
              <Bone className="h-7 w-20 rounded-lg" />
              <Bone className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SystemHealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Bone className="h-48 rounded-xl" />
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}
