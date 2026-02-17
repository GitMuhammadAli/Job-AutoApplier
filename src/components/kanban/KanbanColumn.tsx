"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { STAGE_CONFIG } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
        "flex w-72 flex-shrink-0 flex-col rounded-xl bg-slate-50/80 transition-colors md:w-full",
        isOver && `ring-2 ring-offset-2 ${config.border} bg-white`
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <div className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
        <h3 className={cn("text-sm font-semibold", config.text)}>
          {config.label}
        </h3>
        <Badge
          variant="secondary"
          className="ml-auto rounded-full px-2 py-0 text-[10px] font-medium"
        >
          {jobs.length}
        </Badge>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 px-2 pb-3 min-h-[120px] transition-colors rounded-b-xl",
          isOver && "bg-white/50"
        )}
      >
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs here"
            description={`Drag a job card here or add a new one`}
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
