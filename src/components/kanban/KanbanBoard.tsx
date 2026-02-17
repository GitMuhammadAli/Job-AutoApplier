"use client";

import { useEffect, useMemo, useCallback } from "react";
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
import { useJobStore } from "@/store/useJobStore";
import { STAGES } from "@/lib/utils";
import { StatsBar } from "@/components/analytics/StatsBar";
import { KanbanColumn } from "./KanbanColumn";
import { JobCard } from "./JobCard";
import { updateStage } from "@/app/actions/job";
import type { Job, Stage } from "@/types";
import { useState } from "react";

interface KanbanBoardProps {
  initialJobs: Job[];
}

export function KanbanBoard({ initialJobs }: KanbanBoardProps) {
  const { jobs, setJobs, filter, search, updateJobStage } = useJobStore();
  const [activeJob, setActiveJob] = useState<Job | null>(null);

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
          j.company.toLowerCase().includes(q) ||
          j.role.toLowerCase().includes(q) ||
          (j.location && j.location.toLowerCase().includes(q))
      );
    }

    return result;
  }, [jobs, filter, search]);

  const jobsByStage = useMemo(() => {
    const map: Record<Stage, Job[]> = {
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
    async (jobId: string, newStage: Stage, oldStage: Stage) => {
      if (newStage === oldStage) return;

      updateJobStage(jobId, newStage);
      toast.success(`Moved to ${newStage.toLowerCase().replace("_", " ")}`);

      try {
        await updateStage(jobId, newStage, oldStage);
      } catch {
        updateJobStage(jobId, oldStage);
        toast.error("Failed to update stage. Reverted.");
      }
    },
    [updateJobStage]
  );

  const handleDragStart = useCallback(
    (event: { active: { data: { current?: { job?: Job } } } }) => {
      const job = event.active.data.current?.job as Job | undefined;
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
      const newStage = over.id as Stage;
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.stage === newStage) return;

      await handleStageChange(jobId, newStage, job.stage);
    },
    [jobs, handleStageChange]
  );

  return (
    <div className="space-y-6">
      <StatsBar jobs={jobs} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 md:grid md:grid-cols-6 md:overflow-x-visible">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage as Stage}
              jobs={jobsByStage[stage as Stage]}
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
