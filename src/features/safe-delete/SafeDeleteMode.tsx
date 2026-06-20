import { useEffect } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { MediaGrid } from "../../components/media/MediaGrid";
import { useRejectedItems, useSelectedCount } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";

export function SafeDeleteMode() {
  const setMode = useAppStore((state) => state.setMode);
  const showToast = useAppStore((state) => state.showToast);
  const rejects = useRejectedItems();
  const selectedCount = useSelectedCount();
  const holdingBatches = useLibraryStore((state) => state.holdingBatches);
  const loadingRejects = useLibraryStore((state) => state.loadingRejects);
  const movingToHolding = useLibraryStore((state) => state.movingToHolding);
  const loadRejects = useLibraryStore((state) => state.loadRejects);
  const loadHoldingBatches = useLibraryStore((state) => state.loadHoldingBatches);
  const moveAllRejectsToHolding = useLibraryStore((state) => state.moveAllRejectsToHolding);
  const rescueSelectedRejectsToMaybe = useLibraryStore((state) => state.rescueSelectedRejectsToMaybe);
  const restoreHoldingBatchById = useLibraryStore((state) => state.restoreHoldingBatchById);
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const totalBytes = rejects.reduce((sum, item) => sum + item.sizeBytes, 0);

  const latestMovedBatch = holdingBatches.find((batch) => batch.status === "moved");

  useEffect(() => {
    void loadRejects();
    void loadHoldingBatches();
  }, [loadRejects, loadHoldingBatches]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleMoveToHolding = async () => {
    const count = rejects.length;
    const jobId = await moveAllRejectsToHolding();
    if (jobId) {
      showToast(`Queued holding move for ${count} files — see Operations Queue`);
    }
  };

  const handleRescue = async () => {
    const count = await rescueSelectedRejectsToMaybe();
    if (count > 0) {
      showToast(`Marked ${count} selected as maybe`);
    }
  };

  const handleRevealHolding = async () => {
    if (!latestMovedBatch) {
      return;
    }
    try {
      await openPath(latestMovedBatch.holdingPath);
    } catch {
      showToast("Could not open holding folder");
    }
  };

  const handleRestore = async () => {
    if (!latestMovedBatch) {
      return;
    }
    await restoreHoldingBatchById(latestMovedBatch.id);
    showToast(`Queued restore for ${latestMovedBatch.itemIds.length} files`);
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
              Select items to rescue from the reject batch before moving to holding.
            </p>
            <button
              className="btn"
              style={{ marginTop: 10 }}
              type="button"
              disabled={selectedCount === 0}
              onClick={() => void handleRescue()}
            >
              Mark selected as Maybe ({selectedCount})
            </button>
          </div>

          <div className="step done">
            <div className="title" style={{ fontSize: 13 }}>
              2. Move to holding folder
            </div>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Files move into _MediaMaster_Holding under each source root, preserving
              relative paths.
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
              3. Review holding folder
            </div>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {latestMovedBatch
                ? `${latestMovedBatch.label} · ${latestMovedBatch.itemIds.length} files`
                : "No active holding batch yet."}
            </p>
            <button
              className="btn"
              style={{ marginTop: 10 }}
              type="button"
              disabled={!latestMovedBatch}
              onClick={() => void handleRevealHolding()}
            >
              Open Holding Folder
            </button>{" "}
            <button
              className="btn"
              style={{ marginTop: 10 }}
              type="button"
              disabled={!latestMovedBatch}
              onClick={() => void handleRestore()}
            >
              Restore Batch
            </button>
            <button className="btn danger" style={{ marginTop: 10 }} type="button" disabled>
              Delete Holding Folder
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
