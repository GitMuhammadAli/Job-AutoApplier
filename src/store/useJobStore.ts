import { create } from "zustand";
import type { Job, Stage } from "@/types";
interface JobStore { jobs: Job[]; filter: Stage | "ALL"; search: string; setJobs: (jobs: Job[]) => void; setFilter: (f: Stage | "ALL") => void; setSearch: (s: string) => void; updateJobStage: (id: string, stage: Stage) => void; removeJob: (id: string) => void; }
export const useJobStore = create<JobStore>((set) => ({
  jobs: [], filter: "ALL", search: "",
  setJobs: (jobs) => set({ jobs }),
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  updateJobStage: (id, stage) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, stage } : j)) })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}));
