"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { ResumeBadge } from "@/components/shared/ResumeBadge";
import { StageSelector } from "@/components/shared/StageSelector";
import { daysAgo } from "@/lib/utils";
import type { Job, Stage } from "@/types";

interface JobCardProps {
  job: Job;
  onStageChange: (jobId: string, newStage: Stage, oldStage: Stage) => void;
}

export function JobCard({ job, onStageChange }: JobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job.id,
      data: { job },
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const days = daysAgo(job.appliedDate ?? null);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group cursor-grab active:cursor-grabbing rounded-xl border-0 p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
        isDragging ? "opacity-50 shadow-lg rotate-2 z-50" : ""
      }`}
    >
      {/* Company & Role */}
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="h-3 w-3" />
            <span className="font-medium">{job.company}</span>
          </div>
          <StageSelector
            currentStage={job.stage}
            onStageChange={(newStage) =>
              onStageChange(job.id, newStage, job.stage)
            }
          />
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-800 leading-tight">
          {job.role}
        </p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <PlatformBadge platform={job.platform} />
        <ResumeBadge resume={job.resumeUsed} />
      </div>

      {/* Footer */}
      {days !== null && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Clock className="h-2.5 w-2.5" />
          <span>
            {days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days}d ago`}
          </span>
        </div>
      )}

      {/* Location / Work type */}
      {(job.location || job.workType) && (
        <div className="mt-1 text-[10px] text-slate-400">
          {[job.location, job.workType !== "ONSITE" ? job.workType : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </Card>
  );
}
