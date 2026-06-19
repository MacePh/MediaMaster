import { useAppStore } from "../../stores/appStore";
import { useJobsStore } from "../../stores/jobsStore";

export function FfmpegStatusIcon() {
  const ffmpegReady = useAppStore((state) => state.ffmpegReady);
  const ffmpegTooltip = useAppStore((state) => state.ffmpegTooltip);
  const jobsActive = useJobsStore((state) => state.jobs.some((job) => !job.done));

  const status = !ffmpegReady ? "off" : jobsActive ? "working" : "ready";
  const title = jobsActive
    ? "FFmpeg working"
    : (ffmpegTooltip ?? (ffmpegReady ? "FFmpeg ready" : "FFmpeg not detected"));

  return (
    <span className="ffmpeg-status" title={title} aria-label={title}>
      <span className={`ffmpeg-dot ${status}`} />
    </span>
  );
}
