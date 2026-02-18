"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
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
import { STAGES } from "@/lib/utils";
import { StatsBar } from "@/components/analytics/StatsBar";
import { KanbanColumn } from "./KanbanColumn";
import { JobCard } from "./JobCard";
import { updateStage } from "@/app/actions/job";
import type { JobStage } from "@prisma/client";

interface KanbanBoardProps {
  initialJobs: UserJobWithGlobal[];
}

export function KanbanBoard({ initialJobs }: KanbanBoardProps) {
  const { jobs, setJobs, filter, search, updateJobStage } = useJobStore();
  const [activeJob, setActiveJob] = useState<UserJobWithGlobal | null>(null);

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
    <div className="space-y-6">
      <StatsBar jobs={jobs} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none md:grid md:grid-cols-3 md:overflow-x-visible lg:grid-cols-6">
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
