"use client";

import { create } from "zustand";
import type { JobStage } from "@prisma/client";

interface GlobalJobData {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  category: string | null;
  skills: string[];
  source: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  companyEmail: string | null;
  postedDate: Date | string | null;
  firstSeenAt: Date | string;
  createdAt: Date | string;
}

interface ApplicationData {
  id: string;
  status: string;
  sentAt: Date | string | null;
}

export interface UserJobWithGlobal {
  id: string;
  userId: string;
  globalJobId: string;
  stage: JobStage;
  matchScore: number | null;
  matchReasons: string[];
  notes: string | null;
  coverLetter: string | null;
  isBookmarked: boolean;
  isDismissed: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  globalJob: GlobalJobData;
  application?: ApplicationData | null;
}

interface JobStore {
  jobs: UserJobWithGlobal[];
  filter: JobStage | "ALL";
  search: string;
  sourceFilter: string | null;
  categoryFilter: string | null;
  minScore: number;
  setJobs: (jobs: UserJobWithGlobal[]) => void;
  setFilter: (filter: JobStage | "ALL") => void;
  setSearch: (search: string) => void;
  setSourceFilter: (source: string | null) => void;
  setCategoryFilter: (category: string | null) => void;
  setMinScore: (score: number) => void;
  updateJobStage: (id: string, stage: JobStage) => void;
  revertMove: (id: string, oldStage: JobStage) => void;
  removeJob: (id: string) => void;
  getJobsByStage: (stage: JobStage) => UserJobWithGlobal[];
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  filter: "ALL",
  search: "",
  sourceFilter: null,
  categoryFilter: null,
  minScore: 0,

  setJobs: (jobs) => set({ jobs }),

  setFilter: (filter) => set({ filter }),

  setSearch: (search) => set({ search }),

  setSourceFilter: (sourceFilter) => set({ sourceFilter }),

  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  setMinScore: (minScore) => set({ minScore }),

  updateJobStage: (id, stage) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, stage } : j)),
    })),

  revertMove: (id, oldStage) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, stage: oldStage } : j)),
    })),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    })),

  getJobsByStage: (stage) => {
    const { jobs, sourceFilter, categoryFilter, minScore } = get();
    return jobs.filter((j) => {
      if (j.stage !== stage) return false;
      if (sourceFilter && j.globalJob.source !== sourceFilter) return false;
      if (categoryFilter && j.globalJob.category !== categoryFilter) return false;
      if (minScore > 0 && (j.matchScore ?? 0) < minScore) return false;
      return true;
    });
  },
}));
