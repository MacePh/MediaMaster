import { create } from "zustand";
import { cancelJob, clearFinishedJobs, listJobs } from "../lib/tauri";
import type { Job, JobDoneEvent, JobProgressEvent, JobQueueStatus } from "../lib/types";

const ACTIVE_STATUSES: JobQueueStatus[] = ["queued", "running"];

function isActive(job: Job): boolean {
  return ACTIVE_STATUSES.includes(job.status);
}

function isFfmpegJob(job: Job): boolean {
  return job.kind === "ffprobe_scan";
}

interface JobsState {
  jobs: Job[];
  loadJobs: () => Promise<void>;
  applyProgress: (event: JobProgressEvent) => void;
  applyDone: (event: JobDoneEvent) => void;
  cancelJobById: (jobId: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  hasActiveJobs: () => boolean;
  hasActiveFfmpegJobs: () => boolean;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  loadJobs: async () => {
    const jobs = await listJobs();
    set({ jobs });
  },
  applyProgress: (event) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === event.jobId
          ? { ...job, progress: event.progress, status: event.status }
          : job,
      ),
    }));
  },
  applyDone: (event) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === event.jobId
          ? {
              ...job,
              status: event.status,
              progress: event.status === "done" ? 100 : job.progress,
              batchId: event.batchId ?? job.batchId,
              error: event.error ?? job.error,
            }
          : job,
      ),
    }));
  },
  cancelJobById: async (jobId) => {
    await cancelJob(jobId);
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId ? { ...job, status: "cancelled" } : job,
      ),
    }));
  },
  clearFinished: async () => {
    await clearFinishedJobs();
    set((state) => ({
      jobs: state.jobs.filter((job) => isActive(job)),
    }));
  },
  hasActiveJobs: () => get().jobs.some((job) => isActive(job)),
  hasActiveFfmpegJobs: () =>
    get().jobs.some((job) => isActive(job) && isFfmpegJob(job)),
}));

export function jobKindLabel(kind: Job["kind"]): string {
  switch (kind) {
    case "holding_move":
      return "Holding move";
    case "holding_restore":
      return "Holding restore";
    case "ffprobe_scan":
      return "FFprobe scan";
    default:
      return kind.replace(/_/g, " ");
  }
}
