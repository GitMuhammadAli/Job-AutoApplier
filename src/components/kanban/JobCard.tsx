"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Clock, ExternalLink, DollarSign } from "lucide-react";
import { ApplyTypeBadge } from "@/components/shared/ApplyTypeBadge";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { ResumeBadge } from "@/components/shared/ResumeBadge";
import { StageSelector } from "@/components/shared/StageSelector";
import { daysAgo } from "@/lib/utils";
import Link from "next/link";
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
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative cursor-grab active:cursor-grabbing rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:ring-slate-300/60 ${
        isDragging ? "opacity-50 shadow-lg rotate-2 z-50 ring-blue-300" : ""
      }`}
    >
      {/* Company & Role */}
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{job.company}</span>
          </div>
          <StageSelector
            currentStage={job.stage}
            onStageChange={(newStage) =>
              onStageChange(job.id, newStage, job.stage)
            }
          />
        </div>
        <Link
          href={`/jobs/${job.id}`}
          className="mt-1 text-[13px] font-bold text-slate-800 leading-snug hover:text-blue-600 transition-colors block"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {job.role}
        </Link>
      </div>

      {/* Apply type + Platform + Resume badges */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {job.applyType && job.applyType !== "UNKNOWN" && (
          <ApplyTypeBadge applyType={job.applyType} />
        )}
        <PlatformBadge platform={job.platform} />
        <ResumeBadge resume={job.resumeUsed} />
      </div>

      {/* Salary */}
      {job.salary && (
        <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mb-1.5">
          <DollarSign className="h-3 w-3" />
          <span>{job.salary}</span>
        </div>
      )}

      {/* Match score */}
      {job.matchScore != null && job.matchScore > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-slate-400 font-medium">Match</span>
            <span
              className={`font-bold ${
                job.matchScore >= 70
                  ? "text-emerald-600"
                  : job.matchScore >= 40
                    ? "text-amber-600"
                    : "text-slate-400"
              }`}
            >
              {job.matchScore}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-100">
            <div
              className={`h-1 rounded-full transition-all duration-500 ${
                job.matchScore >= 70
                  ? "bg-emerald-500"
                  : job.matchScore >= 40
                    ? "bg-amber-400"
                    : "bg-slate-300"
              }`}
              style={{ width: `${Math.min(job.matchScore, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          {days !== null && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{days === 0 ? "Today" : days === 1 ? "1d" : `${days}d`}</span>
            </div>
          )}
          {(job.location || job.workType) && (
            <div className="text-[10px] text-slate-400 truncate">
              {[job.location, job.workType !== "ONSITE" ? job.workType : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>

        {/* Apply button */}
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all duration-200 shadow-sm hover:shadow ${
              job.isDirectApply || job.applyType === "EASY_APPLY"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {job.isDirectApply || job.applyType === "EASY_APPLY" ? "Easy" : "Apply"}
          </a>
        )}
      </div>
    </div>
  );
}
