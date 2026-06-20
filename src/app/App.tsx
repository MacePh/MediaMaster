import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { detectFfmpeg, detectVlc, getDbStatus } from "../lib/tauri";
import { JobTray } from "../components/shell/JobTray";
import { RightPanel } from "../components/shell/RightPanel";
import { Sidebar } from "../components/shell/Sidebar";
import { TopBar } from "../components/shell/TopBar";
import { Toast } from "../components/shared/Toast";
import { AuditMode } from "../features/audit/AuditMode";
import { BrowseMode } from "../features/browse/BrowseMode";
import { PurgeMode } from "../features/purge/PurgeMode";
import { SafeDeleteMode } from "../features/safe-delete/SafeDeleteMode";
import { TaggingMode } from "../features/tagging/TaggingMode";
import { useAppStore } from "../stores/appStore";
import { useJobsStore } from "../stores/jobsStore";
import { useLibraryStore } from "../stores/libraryStore";
import type { JobDoneEvent, JobProgressEvent, ScanProgress } from "../lib/types";

export function App() {
  const mode = useAppStore((state) => state.mode);
  const setDbStatus = useAppStore((state) => state.setDbStatus);
  const setFfmpegStatus = useAppStore((state) => state.setFfmpegStatus);
  const setVlcStatus = useAppStore((state) => state.setVlcStatus);
  const showToast = useAppStore((state) => state.showToast);
  const loadCatalog = useLibraryStore((state) => state.loadCatalog);
  const setScanProgress = useLibraryStore((state) => state.setScanProgress);
  const refreshMedia = useLibraryStore((state) => state.refreshMedia);
  const finishHoldingJob = useLibraryStore((state) => state.finishHoldingJob);
  const loadAuditFindings = useLibraryStore((state) => state.loadAuditFindings);
  const loadJobs = useJobsStore((state) => state.loadJobs);
  const applyJobProgress = useJobsStore((state) => state.applyProgress);
  const applyJobDone = useJobsStore((state) => state.applyDone);

  useEffect(() => {
    void loadCatalog();
    void loadJobs();
  }, [loadCatalog, loadJobs]);

  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan:progress", (event) => {
      setScanProgress(event.payload);

      if (event.payload.phase === "done") {
        void refreshMedia();
        showToast(
          `Scan complete — ${event.payload.added.toLocaleString()} added, ${event.payload.skipped.toLocaleString()} unchanged`,
        );
      }

      if (event.payload.phase === "error") {
        showToast(event.payload.error ?? "Scan failed");
      }
    });

    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [refreshMedia, setScanProgress, showToast]);

  useEffect(() => {
    const unlistenProgress = listen<JobProgressEvent>("job:progress", (event) => {
      applyJobProgress(event.payload);
    });

    const unlistenDone = listen<JobDoneEvent>("job:done", (event) => {
      applyJobDone(event.payload);

      if (event.payload.status === "failed" && event.payload.error) {
        showToast(event.payload.error);
      }

      if (event.payload.batchId) {
        void finishHoldingJob();
        if (event.payload.status === "done") {
          showToast("Holding operation complete");
        }
      } else if (useLibraryStore.getState().movingToHolding) {
        void finishHoldingJob();
      } else if (event.payload.status === "done") {
        void refreshMedia();
        void loadAuditFindings();
        showToast("Metadata scan complete");
      }

      void loadJobs();
    });

    return () => {
      void unlistenProgress.then((stop) => stop());
      void unlistenDone.then((stop) => stop());
    };
  }, [
    applyJobDone,
    applyJobProgress,
    finishHoldingJob,
    loadAuditFindings,
    loadJobs,
    refreshMedia,
    showToast,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        const status = await getDbStatus();
        setDbStatus(status.path, status.migrationCount);
      } catch (error) {
        console.error("Failed to load database status", error);
      }

      try {
        const ffmpeg = await detectFfmpeg();
        if (ffmpeg.ffmpegPath) {
          const versionLine = ffmpeg.ffmpegVersion?.split("\n")[0];
          const tooltip = [versionLine, ffmpeg.ffmpegPath].filter(Boolean).join("\n");
          setFfmpegStatus(true, tooltip || "FFmpeg ready");
        } else {
          setFfmpegStatus(false, "FFmpeg not detected");
        }
      } catch (error) {
        console.error("Failed to detect FFmpeg", error);
        setFfmpegStatus(false, "FFmpeg not detected");
      }

      try {
        const vlc = await detectVlc();
        if (vlc.vlcPath) {
          const versionLine = vlc.vlcVersion?.split("\n")[0];
          const tooltip = [versionLine, vlc.vlcPath].filter(Boolean).join("\n");
          setVlcStatus(true, tooltip || "VLC ready");
        } else {
          setVlcStatus(false, "VLC not detected");
        }
      } catch (error) {
        console.error("Failed to detect VLC", error);
        setVlcStatus(false, "VLC not detected");
      }
    })();
  }, [setDbStatus, setFfmpegStatus, setVlcStatus]);

  return (
    <div className="app">
      <TopBar />
      <Sidebar />
      <main className="main">
        {mode === "browse" ? <BrowseMode /> : null}
        {mode === "purge" ? <PurgeMode /> : null}
        {mode === "tagging" ? <TaggingMode /> : null}
        {mode === "safe_delete" ? <SafeDeleteMode /> : null}
        {mode === "audit" ? <AuditMode /> : null}
      </main>
      <RightPanel />
      <JobTray />
      <Toast />
    </div>
  );
}
