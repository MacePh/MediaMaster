import { useEffect } from "react";
import { MediaGrid } from "../../components/media/MediaGrid";
import { useRejectedItems } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";

export function SafeDeleteMode() {
  const setMode = useAppStore((state) => state.setMode);
  const showToast = useAppStore((state) => state.showToast);
  const rejects = useRejectedItems();
  const loadingRejects = useLibraryStore((state) => state.loadingRejects);
  const movingToHolding = useLibraryStore((state) => state.movingToHolding);
  const loadRejects = useLibraryStore((state) => state.loadRejects);
  const moveAllRejectsToHolding = useLibraryStore((state) => state.moveAllRejectsToHolding);
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const totalBytes = rejects.reduce((sum, item) => sum + item.sizeBytes, 0);

  useEffect(() => {
    void loadRejects();
  }, [loadRejects]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleMoveToHolding = async () => {
    const batchId = await moveAllRejectsToHolding();
    if (batchId) {
      showToast(`Moved ${rejects.length} files to holding folder`);
    }
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
          {loadingRejects ? (
            <div className="empty">Loading rejects from catalog…</div>
          ) : rejects.length === 0 ? (
            <div className="empty">
              No rejected files pending holding. Mark items as reject in Purge Mode first.
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
              All catalog rejects not yet in holding are listed here — not limited to the
              current browse page.
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
              Files move into a dated _MediaMaster_Holding folder under each source root,
              preserving relative paths.
            </p>
            <button
              className="btn primary"
              style={{ marginTop: 10, width: "100%", textAlign: "center" }}
              type="button"
              onClick={() => void handleMoveToHolding()}
              disabled={rejects.length === 0 || movingToHolding}
            >
              {movingToHolding
                ? "Moving…"
                : `Move ${rejects.length} to Holding Folder`}
            </button>
          </div>

          <div className="step">
            <div className="title" style={{ fontSize: 13 }}>
              3. Final delete later
            </div>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Browse the holding folder in Explorer first. Restore is planned for a
              follow-up; permanent delete remains disabled in v1.
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
