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
  setJobs: (jobs: UserJobWithGlobal[]) => void;
  setFilter: (filter: JobStage | "ALL") => void;
  setSearch: (search: string) => void;
  updateJobStage: (id: string, stage: JobStage) => void;
  removeJob: (id: string) => void;
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  filter: "ALL",
  search: "",

  setJobs: (jobs) => set({ jobs }),

  setFilter: (filter) => set({ filter }),

  setSearch: (search) => set({ search }),

  updateJobStage: (id, stage) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, stage } : j)),
    })),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    })),
}));
