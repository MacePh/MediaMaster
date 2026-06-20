import { create } from "zustand";
import type { AppMode } from "../lib/types";

interface AppState {
  mode: AppMode;
  dbPath: string | null;
  migrationCount: number | null;
  ffmpegReady: boolean;
  ffmpegTooltip: string | null;
  vlcReady: boolean;
  vlcTooltip: string | null;
  toast: string | null;
  setMode: (mode: AppMode) => void;
  setDbStatus: (path: string, migrationCount: number) => void;
  setFfmpegStatus: (ready: boolean, tooltip?: string | null) => void;
  setVlcStatus: (ready: boolean, tooltip?: string | null) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "browse",
  dbPath: null,
  migrationCount: null,
  ffmpegReady: false,
  ffmpegTooltip: null,
  vlcReady: false,
  vlcTooltip: null,
  toast: null,
  setMode: (mode) => set({ mode }),
  setDbStatus: (path, migrationCount) => set({ dbPath: path, migrationCount }),
  setFfmpegStatus: (ffmpegReady, ffmpegTooltip = null) =>
    set({ ffmpegReady, ffmpegTooltip }),
  setVlcStatus: (vlcReady, vlcTooltip = null) => set({ vlcReady, vlcTooltip }),
  showToast: (message) => set({ toast: message }),
  clearToast: () => set({ toast: null }),
}));
