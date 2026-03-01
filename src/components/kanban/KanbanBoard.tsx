"use client";

import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { useJobStore, type UserJobWithGlobal } from "@/store/useJobStore";
import { STAGES, STAGE_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { StatsBar } from "@/components/analytics/StatsBar";
import { KanbanColumn } from "./KanbanColumn";
import { JobCard } from "./JobCard";
import { updateStage } from "@/app/actions/job";
import type { JobStage } from "@prisma/client";

interface KanbanBoardProps {
  initialJobs: UserJobWithGlobal[];
}

export function KanbanBoard({ initialJobs }: KanbanBoardProps) {
  const jobs = useJobStore((s) => s.jobs);
  const setJobs = useJobStore((s) => s.setJobs);
  const filter = useJobStore((s) => s.filter);
  const search = useJobStore((s) => s.search);
  const updateJobStage = useJobStore((s) => s.updateJobStage);
  const [activeJob, setActiveJob] = useState<UserJobWithGlobal | null>(null);
  const [mobileStage, setMobileStage] = useState<JobStage>("SAVED");
  const pendingMoves = React.useRef(new Set<string>());

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs, setJobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (filter !== "ALL") {
      result = result.filter((j) => j.stage === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.globalJob.company.toLowerCase().includes(q) ||
          j.globalJob.title.toLowerCase().includes(q) ||
          (j.globalJob.location && j.globalJob.location.toLowerCase().includes(q))
      );
    }

    return result;
  }, [jobs, filter, search]);

  const jobsByStage = useMemo(() => {
    const map: Record<JobStage, UserJobWithGlobal[]> = {
      SAVED: [],
      APPLIED: [],
      INTERVIEW: [],
      OFFER: [],
      REJECTED: [],
      GHOSTED: [],
    };
    for (const job of filteredJobs) {
      map[job.stage].push(job);
    }
    return map;
  }, [filteredJobs]);

  const handleStageChange = useCallback(
    async (jobId: string, newStage: JobStage, oldStage: JobStage) => {
      if (newStage === oldStage) return;
      if (pendingMoves.current.has(jobId)) return;

      pendingMoves.current.add(jobId);
      updateJobStage(jobId, newStage);
      toast.success(`Moved to ${newStage.toLowerCase().replace("_", " ")}`);

      try {
        const result = await updateStage(jobId, newStage, oldStage);
        if (!result.success) {
          updateJobStage(jobId, oldStage);
          toast.error(result.error || "Failed to update stage. Reverted.");
        }
      } catch {
        updateJobStage(jobId, oldStage);
        toast.error("Failed to update stage. Reverted.");
      } finally {
        pendingMoves.current.delete(jobId);
      }
    },
    [updateJobStage]
  );

  const handleDragStart = useCallback(
    (event: { active: { data: { current?: { job?: UserJobWithGlobal } } } }) => {
      const job = event.active.data.current?.job;
      if (job) setActiveJob(job);
    },
    []
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveJob(null);
      const { active, over } = event;
      if (!over) return;

      const jobId = active.id as string;
      const newStage = over.id as JobStage;
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.stage === newStage) return;

      await handleStageChange(jobId, newStage, job.stage);
    },
    [jobs, handleStageChange]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <StatsBar jobs={jobs} />

      {/* Mobile: tab-based stage selector */}
      <div className="md:hidden">
        <div className="flex overflow-x-auto gap-1 pb-2 -mx-1 px-1 scrollbar-none">
          {STAGES.map((stage) => {
            const s = stage as JobStage;
            const config = STAGE_CONFIG[s];
            const count = jobsByStage[s].length;
            const isActive = mobileStage === s;
            return (
              <button
                key={stage}
                onClick={() => setMobileStage(s)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap shrink-0 touch-manipulation",
                  isActive
                    ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                {config.label}
                <span className={cn(
                  "ml-0.5 min-w-[18px] text-center rounded-full px-1 py-0.5 text-[10px] font-bold",
                  isActive
                    ? "bg-white/20 dark:bg-zinc-900/30 text-white dark:text-zinc-900"
                    : "bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <KanbanColumn
            stage={mobileStage}
            jobs={jobsByStage[mobileStage]}
            onStageChange={handleStageChange}
            isMobile
          />
        </DndContext>
      </div>

      {/* Desktop: full kanban grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage as JobStage}
              jobs={jobsByStage[stage as JobStage]}
              onStageChange={handleStageChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeJob ? (
            <div className="w-72 rotate-3 opacity-90">
              <JobCard
                job={activeJob}
                onStageChange={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
