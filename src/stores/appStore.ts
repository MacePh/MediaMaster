import { create } from "zustand";
import type { AppMode } from "../lib/types";

interface AppState {
  mode: AppMode;
  dbPath: string | null;
  migrationCount: number | null;
  ffmpegLabel: string;
  toast: string | null;
  setMode: (mode: AppMode) => void;
  setDbStatus: (path: string, migrationCount: number) => void;
  setFfmpegLabel: (label: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "browse",
  dbPath: null,
  migrationCount: null,
  ffmpegLabel: "FFmpeg not detected",
  toast: null,
  setMode: (mode) => set({ mode }),
  setDbStatus: (path, migrationCount) => set({ dbPath: path, migrationCount }),
  setFfmpegLabel: (ffmpegLabel) => set({ ffmpegLabel }),
  showToast: (message) => set({ toast: message }),
  clearToast: () => set({ toast: null }),
}));
