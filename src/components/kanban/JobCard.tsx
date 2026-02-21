"use client";

import { useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Clock, ExternalLink, Mail, Zap, FileText } from "lucide-react";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { StageSelector } from "@/components/shared/StageSelector";
import { daysAgo } from "@/lib/utils";
import type { UserJobWithGlobal } from "@/store/useJobStore";
import type { JobStage } from "@prisma/client";

interface JobCardProps {
  job: UserJobWithGlobal;
  onStageChange: (jobId: string, newStage: JobStage, oldStage: JobStage) => void;
}

function getFreshness(days: number | null): { label: string; color: string } {
  if (days === null) return { label: "", color: "" };
  if (days <= 1) return { label: "Fresh", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
  if (days <= 3) return { label: "Recent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  if (days <= 7) return { label: "This week", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  if (days <= 14) return { label: "Aging", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" };
  return { label: "Old", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
}

function getApplySpeed(job: UserJobWithGlobal): { label: string; fast: boolean } | null {
  if (job.application?.status !== "SENT" || !job.application.sentAt) return null;
  const sentAt = new Date(job.application.sentAt).getTime();
  const firstSeen = new Date(job.globalJob.firstSeenAt).getTime();
  const diffMin = Math.max(0, Math.round((sentAt - firstSeen) / 60000));

  if (diffMin <= 2) return { label: `\u26A1 ${diffMin}m`, fast: true };
  if (diffMin <= 20) return { label: `${diffMin}m`, fast: true };
  return { label: `${diffMin}m`, fast: false };
}

export function JobCard({ job, onStageChange }: JobCardProps) {
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job.id,
      data: { job },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const g = job.globalJob;
  const days = daysAgo(g.postedDate ?? null);
  const hasApp = job.application?.status === "SENT";
  const speed = getApplySpeed(job);
  const freshness = getFreshness(days);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerStart.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStart.current) return;
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      pointerStart.current = null;
      if (dx > 5 || dy > 5) return;
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button'], select, input")) return;
      router.push(`/jobs/${job.id}`);
    },
    [router, job.id]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        handlePointerDown(e);
        const dndHandler = (listeners as Record<string, Function> | undefined)?.onPointerDown;
        if (dndHandler) dndHandler(e);
      }}
      onPointerUp={handlePointerUp}
      className={`group relative cursor-pointer active:cursor-grabbing rounded-xl bg-white dark:bg-zinc-800 p-3.5 md:p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-shadow transition-transform duration-200 hover:shadow-md hover:-translate-y-0.5 hover:ring-slate-200/80 dark:hover:ring-zinc-600/80 touch-manipulation ${
        isDragging ? "opacity-50 shadow-lg rotate-2 z-50 ring-blue-300" : ""
      }`}
    >
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 font-medium">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{g.company}</span>
          </div>
          <StageSelector
            currentStage={job.stage}
            onStageChange={(newStage) =>
              onStageChange(job.id, newStage, job.stage)
            }
          />
        </div>
        <span className="mt-1 text-sm font-bold text-slate-800 dark:text-zinc-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors block">
          {g.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-2">
        <PlatformBadge source={g.source} />
        {freshness.label && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${freshness.color}`}>
            {freshness.label}
          </span>
        )}
        {hasApp && speed && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            speed.fast
              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          }`}>
            <Zap className="h-2.5 w-2.5" /> {speed.label}
          </span>
        )}
        {hasApp && !speed && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Mail className="h-2.5 w-2.5" /> Applied
          </span>
        )}
        {job.application?.status === "DRAFT" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <FileText className="h-2.5 w-2.5" /> Draft
          </span>
        )}
      </div>

      {g.salary && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1.5 truncate">
          {g.salary}
        </div>
      )}

      {job.matchScore != null && job.matchScore > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="text-slate-400 dark:text-zinc-500 font-medium">Match</span>
            <span
              className={`font-bold ${
                job.matchScore >= 70
                  ? "text-emerald-600 dark:text-emerald-400"
                  : job.matchScore >= 40
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400 dark:text-zinc-500"
              }`}
            >
              {Math.round(job.matchScore)}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-zinc-700">
            <div
              className={`h-1 rounded-full transition-all duration-500 ${
                job.matchScore >= 70
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : job.matchScore >= 40
                    ? "bg-amber-400 dark:bg-amber-500"
                    : "bg-slate-300 dark:bg-zinc-600"
              }`}
              style={{ width: `${Math.min(job.matchScore, 100)}%` }}
            />
          </div>
          {job.matchReasons && job.matchReasons.length > 0 && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
              {job.matchReasons.slice(0, 3).join(" \u00B7 ")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-50 dark:border-zinc-700/50">
        <div className="flex items-center gap-2 min-w-0">
          {days !== null && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
              <Clock className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{days === 0 ? "Today" : days === 1 ? "1d" : `${days}d`}</span>
            </div>
          )}
          {g.location && (
            <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">{g.location}</div>
          )}
        </div>

        {g.applyUrl && (
          <a
            href={g.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors duration-200 shadow-sm hover:shadow bg-blue-500 text-white hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none touch-manipulation"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Apply
          </a>
        )}
      </div>
    </div>
  );
}
