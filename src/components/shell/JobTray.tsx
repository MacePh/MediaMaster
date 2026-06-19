import { useJobsStore } from "../../stores/jobsStore";

export function JobTray() {
  const jobs = useJobsStore((state) => state.jobs);
  const clearFinished = useJobsStore((state) => state.clearFinished);
  const hasActiveJobs = useJobsStore((state) => state.hasActiveJobs);

  return (
    <footer className="tray">
      <div className="tray-head">
        <span className="tray-title">Operations Queue</span>
        <span className="muted">
          {hasActiveJobs() ? "● Jobs active" : "● Idle"}
        </span>
        <div className="spacer" />
        <button className="btn" type="button" onClick={clearFinished}>
          Clear finished
        </button>
      </div>

      <div className="tray-body">
        {jobs.length === 0 ? (
          <div className="empty">
            No active operations. Purge decisions, holding moves, tag assignments,
            and FFmpeg recipes appear here.
          </div>
        ) : (
          jobs.map((job) => (
            <div className="job" key={job.id}>
              <span>{job.done ? "✓" : "▶"}</span>
              <span className="job-name">{job.name}</span>
              <span className="prog">
                <i style={{ width: `${job.pct}%` }} />
              </span>
              <span className="job-op">{job.op}</span>
              <span className="job-pct">{job.done ? "done" : `${job.pct}%`}</span>
            </div>
          ))
        )}
      </div>
    </footer>
  );
}
