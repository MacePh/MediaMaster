import { useEffect } from "react";
import { detectFfmpeg, getDbStatus } from "../lib/tauri";
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

export function App() {
  const mode = useAppStore((state) => state.mode);
  const setDbStatus = useAppStore((state) => state.setDbStatus);
  const setFfmpegStatus = useAppStore((state) => state.setFfmpegStatus);

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
    })();
  }, [setDbStatus, setFfmpegStatus]);

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
