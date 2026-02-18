"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { STAGE_CONFIG } from "@/lib/utils";
import { JobCard } from "./JobCard";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Job, Stage } from "@/types";

interface KanbanColumnProps {
  stage: Stage;
  jobs: Job[];
  onStageChange: (jobId: string, newStage: Stage, oldStage: Stage) => void;
}

export function KanbanColumn({ stage, jobs, onStageChange }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  const config = STAGE_CONFIG[stage];

  return (
    <div
      className={cn(
        "flex w-[280px] flex-shrink-0 snap-center flex-col rounded-xl bg-white/60 ring-1 ring-slate-100/80 transition-all duration-200 md:w-full md:snap-align-none",
        isOver && "ring-2 bg-white shadow-md scale-[1.01]",
        isOver && config.ring
      )}
    >
      <div className={cn("h-1 rounded-t-xl bg-gradient-to-r", config.gradient)} />

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={cn("h-2 w-2 rounded-full", config.dot)} />
        <h3 className={cn("text-xs font-bold uppercase tracking-wider", config.text)}>
          {config.label}
        </h3>
        <div className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5">
          <span className="text-[10px] font-bold text-slate-500">{jobs.length}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 px-2 pb-2.5 min-h-[80px] transition-colors rounded-b-xl scrollbar-thin overflow-y-auto max-h-[55vh] md:max-h-[68vh]",
          isOver && "bg-slate-50/50"
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
          jobs.map((job) => (
            <JobCard key={job.id} job={job} onStageChange={onStageChange} />
          ))
        )}
      </div>
    </div>
  );
}
