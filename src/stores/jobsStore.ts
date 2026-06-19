import { create } from "zustand";
import type { MockJob } from "../lib/types";

interface JobsState {
  jobs: MockJob[];
  addJob: (name: string, op: string) => void;
  clearFinished: () => void;
  hasActiveJobs: () => boolean;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  addJob: (name, op) => {
    const id = crypto.randomUUID();
    set((state) => ({
      jobs: [{ id, name, op, pct: 0, done: false }, ...state.jobs],
    }));

    const tick = window.setInterval(() => {
      set((state) => ({
        jobs: state.jobs.map((job) => {
          if (job.id !== id || job.done) {
            return job;
          }

          const pct = Math.min(100, job.pct + 12);
          return { ...job, pct, done: pct >= 100 };
        }),
      }));

      const current = get().jobs.find((job) => job.id === id);
      if (current?.done) {
        window.clearInterval(tick);
      }
    }, 180);
  },
  clearFinished: () =>
    set((state) => ({
      jobs: state.jobs.filter((job) => !job.done),
    })),
  hasActiveJobs: () => get().jobs.some((job) => !job.done),
}));
