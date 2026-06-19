import { MediaGrid } from "../../components/media/MediaGrid";
import { useRejectedItems } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useJobsStore } from "../../stores/jobsStore";
import { useLibraryStore } from "../../stores/libraryStore";

export function SafeDeleteMode() {
  const setMode = useAppStore((state) => state.setMode);
  const showToast = useAppStore((state) => state.showToast);
  const addJob = useJobsStore((state) => state.addJob);
  const rejects = useRejectedItems();
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const totalBytes = rejects.reduce((sum, item) => sum + item.sizeBytes, 0);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const queueHoldingMove = () => {
    addJob("Move rejects to holding", "_MediaMaster_Holding batch");
    showToast("Queued holding-folder move. Final delete remains separate.");
  };

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Safe Delete Review</div>
        <div className="muted">
          Rejects are previewed before moving to holding. Final delete is separate.
        </div>
        <div className="spacer" />
        <button className="btn" type="button" onClick={() => setMode("purge")}>
          Back to Purge
        </button>
      </div>

      <div className="safe-layout">
        <div className="grid-wrap">
          {rejects.length === 0 ? (
            <div className="empty">
              No rejected files yet. Mark items as reject in Purge Mode first.
            </div>
          ) : (
            <MediaGrid items={rejects} onToggle={toggleSelection} />
          )}
        </div>

        <aside className="safe-side">
          <div className="summary-card">
            <div className="num">{rejects.length}</div>
            <div className="muted">
              rejects · {formatBytes(totalBytes)} affected
            </div>
          </div>

          <div className="step">
            <div className="title" style={{ fontSize: 13 }}>
              1. Preview affected files
            </div>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Rescue anything that should not be removed from the reject batch.
            </p>
            <button className="btn" style={{ marginTop: 10 }} type="button" disabled>
              Mark selected as Maybe
            </button>
          </div>

          <div className="step done">
            <div className="title" style={{ fontSize: 13 }}>
              2. Move to holding folder
            </div>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Files are moved into a dated _MediaMaster_Holding folder with relative
              paths preserved.
            </p>
            <button
              className="btn primary"
              style={{ marginTop: 10, width: "100%", textAlign: "center" }}
              type="button"
              onClick={queueHoldingMove}
              disabled={rejects.length === 0}
            >
              Move {rejects.length} to Holding Folder
            </button>
          </div>

          <div className="step">
            <div className="title" style={{ fontSize: 13 }}>
              3. Final delete later
            </div>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Browse the holding folder first. Restore all is always available before
              final delete.
            </p>
            <button className="btn" style={{ marginTop: 10 }} type="button" disabled>
              Reveal Holding Folder
            </button>{" "}
            <button className="btn danger" style={{ marginTop: 10 }} type="button" disabled>
              Delete Holding Folder
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
