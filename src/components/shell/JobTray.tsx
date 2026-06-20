import { useJobsStore, jobKindLabel } from "../../stores/jobsStore";

function statusLabel(status: string): string {
  if (status === "done") {
    return "done";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  if (status === "queued") {
    return "queued";
  }
  return "running";
}

export function JobTray() {
  const jobs = useJobsStore((state) => state.jobs);
  const clearFinished = useJobsStore((state) => state.clearFinished);
  const cancelJobById = useJobsStore((state) => state.cancelJobById);
  const hasActiveJobs = useJobsStore((state) => state.hasActiveJobs);

  return (
    <footer className="tray">
      <div className="tray-head">
        <span className="tray-title">Operations Queue</span>
        <span className="muted">
          {hasActiveJobs() ? "● Jobs active" : "● Idle"}
        </span>
        <div className="spacer" />
        <button className="btn" type="button" onClick={() => void clearFinished()}>
          Clear finished
        </button>
      </div>

      <div className="tray-body">
        {jobs.length === 0 ? (
          <div className="empty">
            No active operations. Holding moves, restores, and FFprobe scans
            appear here.
          </div>
        ) : (
          jobs.map((job) => {
            const active = job.status === "queued" || job.status === "running";
            const pct = Math.round(job.progress);

            return (
              <div className="job" key={job.id}>
                <span>{job.status === "done" ? "✓" : active ? "▶" : "○"}</span>
                <span className="job-name">{job.label}</span>
                <span className="prog">
                  <i style={{ width: `${pct}%` }} />
                </span>
                <span className="job-op">{jobKindLabel(job.kind)}</span>
                <span className="job-pct">
                  {job.error
                    ? "failed"
                    : `${statusLabel(job.status)}${active ? ` ${pct}%` : ""}`}
                </span>
                {active ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void cancelJobById(job.id)}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </footer>
  );
}
