"use client";

import { memo, useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { STAGE_CONFIG } from "@/lib/utils";
import { JobCard } from "./JobCard";
import { EmptyState } from "@/components/shared/EmptyState";
import type { UserJobWithGlobal } from "@/store/useJobStore";
import type { JobStage } from "@prisma/client";

const MOBILE_PAGE_SIZE = 10;
const DESKTOP_PAGE_SIZE = 20;

interface KanbanColumnProps {
  stage: JobStage;
  jobs: UserJobWithGlobal[];
  onStageChange: (jobId: string, newStage: JobStage, oldStage: JobStage) => void;
  isMobile?: boolean;
}

export const KanbanColumn = memo(function KanbanColumn({ stage, jobs, onStageChange, isMobile }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const visibleJobs = useMemo(
    () => jobs.slice(0, visibleCount),
    [jobs, visibleCount],
  );
  const hasMore = visibleCount < jobs.length;

  const config = STAGE_CONFIG[stage];

  if (isMobile) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "mt-2 rounded-xl bg-white/60 dark:bg-zinc-900/60 ring-1 ring-slate-100/80 dark:ring-zinc-700/60",
          isOver && "ring-2 bg-white dark:bg-zinc-900 shadow-md",
          isOver && config.ring
        )}
      >
        <div className={cn("h-1 rounded-t-xl bg-gradient-to-r", config.gradient)} />
        <div className="space-y-2 p-2.5 min-h-[100px]">
          {jobs.length === 0 ? (
            <EmptyState
              title="No jobs here"
              description="Drag a card here or add one"
              actionLabel="Add Job"
              actionHref="/jobs/new"
            />
          ) : (
            <>
              {visibleJobs.map((job) => (
                <JobCard key={job.id} job={job} onStageChange={onStageChange} />
              ))}
              {hasMore && (
                <button
                  onClick={() => setVisibleCount((c) => c + pageSize)}
                  className="w-full rounded-lg bg-slate-100 dark:bg-zinc-800 py-2 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors touch-manipulation"
                >
                  Show more ({jobs.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col rounded-xl bg-white/60 dark:bg-zinc-900/60 ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-all duration-200",
        isOver && "ring-2 bg-white dark:bg-zinc-900 shadow-md scale-[1.01]",
        isOver && config.ring
      )}
    >
      <div className={cn("h-1 rounded-t-xl bg-gradient-to-r", config.gradient)} />

      <div className="flex items-center gap-2.5 px-3 py-2.5" title={config.hint}>
        <div className={cn("h-2 w-2 rounded-full", config.dot)} />
        <h3 className={cn("text-xs font-bold uppercase tracking-wider", config.text)}>
          {config.label}
        </h3>
        <div className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 px-1.5">
          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{jobs.length}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2.5 px-2.5 pb-3 min-h-[80px] transition-colors rounded-b-xl scrollbar-thin overflow-y-auto max-h-[68vh]",
          isOver && "bg-slate-50/50 dark:bg-zinc-800/50"
        )}
      >
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs here"
            description="Drag a card here or add one"
            actionLabel="Add Job"
            actionHref="/jobs/new"
          />
        ) : (
          <>
            {visibleJobs.map((job) => (
              <JobCard key={job.id} job={job} onStageChange={onStageChange} />
            ))}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((c) => c + pageSize)}
                className="w-full rounded-lg bg-slate-100 dark:bg-zinc-800 py-1.5 text-[10px] font-medium text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                +{jobs.length - visibleCount} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
