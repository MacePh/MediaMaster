import { ask } from "@tauri-apps/plugin-dialog";
import { usePurgeCounts } from "../../hooks/useLibrarySelectors";
import { useLibraryStore } from "../../stores/libraryStore";
import { SourceFolderList } from "./SourceFolderList";

export function Sidebar() {
  const sources = useLibraryStore((state) => state.sources);
  const folderTrees = useLibraryStore((state) => state.folderTrees);
  const expandedSources = useLibraryStore((state) => state.expandedSources);
  const expandedFolders = useLibraryStore((state) => state.expandedFolders);
  const tags = useLibraryStore((state) => state.tags);
  const activeSourceId = useLibraryStore((state) => state.activeSourceId);
  const activeFolderRelPath = useLibraryStore((state) => state.activeFolderRelPath);
  const activeTagId = useLibraryStore((state) => state.activeTagId);
  const scanningSourceId = useLibraryStore((state) => state.scanningSourceId);
  const scanProgress = useLibraryStore((state) => state.scanProgress);
  const loading = useLibraryStore((state) => state.loading);
  const setActiveSource = useLibraryStore((state) => state.setActiveSource);
  const setActiveFolder = useLibraryStore((state) => state.setActiveFolder);
  const setActiveTag = useLibraryStore((state) => state.setActiveTag);
  const toggleSourceExpanded = useLibraryStore((state) => state.toggleSourceExpanded);
  const toggleFolderExpanded = useLibraryStore((state) => state.toggleFolderExpanded);
  const addSourceFromDialog = useLibraryStore((state) => state.addSourceFromDialog);
  const removeSourceById = useLibraryStore((state) => state.removeSourceById);
  const counts = usePurgeCounts();
  const holdingBatches = useLibraryStore((state) => state.holdingBatches);
  const restoreHoldingBatchById = useLibraryStore((state) => state.restoreHoldingBatchById);

  const activeHolding = holdingBatches.filter((batch) => batch.status === "moved");

  const confirmRemoveSource = async (sourceId: string, sourceName: string) => {
    const confirmed = await ask(
      `Remove "${sourceName}" from the library?\n\nFiles on disk are not deleted. Re-adding the same folder will scan it again.`,
      { title: "Remove source", kind: "warning" },
    );
    if (confirmed) {
      await removeSourceById(sourceId);
    }
  };

  const scanningLabel =
    scanProgress && scanProgress.phase === "scanning"
      ? `Scanning… ${scanProgress.scanned.toLocaleString()} files`
      : loading
        ? "Loading catalog…"
        : null;

  return (
    <aside className="side">
      <div className="side-head side-head-row">
        <span>Sources</span>
        <button
          className="btn side-add"
          type="button"
          disabled={Boolean(scanningSourceId)}
          onClick={() => void addSourceFromDialog()}
        >
          + Add
        </button>
      </div>

      {scanningLabel ? <div className="side-scan">{scanningLabel}</div> : null}

      {sources.map((source) => {
        if (source.id === "all") {
          return (
            <div
              key={source.id}
              className={`side-item ${activeSourceId === source.id && !activeFolderRelPath ? "active" : ""}`}
              onClick={() => setActiveSource(source.id)}
              role="button"
              tabIndex={0}
            >
              <span className="sw" style={{ background: source.color }} />
              {source.name}
              <span className="count">{source.count.toLocaleString()}</span>
            </div>
          );
        }

        const tree = folderTrees[source.id] ?? [];
        const hasFolders = tree.length > 0;
        const isExpanded = expandedSources[source.id] ?? false;
        const isSourceActive = activeSourceId === source.id && !activeFolderRelPath;

        return (
          <div key={source.id}>
            <div
              className={`side-item ${isSourceActive ? "active" : ""}`}
              onClick={() => setActiveSource(source.id)}
              role="button"
              tabIndex={0}
            >
              {hasFolders ? (
                <button
                  type="button"
                  className="side-folder-toggle"
                  aria-label={isExpanded ? "Collapse source" : "Expand source"}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleSourceExpanded(source.id);
                  }}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              ) : (
                <span className="side-folder-spacer" />
              )}
              <span className="sw" style={{ background: source.color }} />
              <span className="side-source-name">{source.name}</span>
              <span className="count">{source.count.toLocaleString()}</span>
              <button
                type="button"
                className="side-remove"
                aria-label={`Remove ${source.name}`}
                title="Remove from library"
                onClick={(event) => {
                  event.stopPropagation();
                  void confirmRemoveSource(source.id, source.name);
                }}
              >
                ×
              </button>
            </div>
            {hasFolders && isExpanded ? (
              <SourceFolderList
                sourceId={source.id}
                nodes={tree}
                depth={0}
                activeSourceId={activeSourceId}
                activeFolderRelPath={activeFolderRelPath}
                expandedFolders={expandedFolders}
                onToggleExpand={(key) => toggleFolderExpanded(key)}
                onSelectFolder={(sourceId, relPath) => setActiveFolder(sourceId, relPath)}
              />
            ) : null}
          </div>
        );
      })}

      <div className="side-head">Tags</div>
      {tags.length === 0 ? (
        <div className="side-empty">No tags yet</div>
      ) : (
        tags.map((tag) => (
          <div
            key={tag.id}
            className={`side-item ${activeTagId === tag.id ? "active" : ""}`}
            onClick={() => setActiveTag(tag.id)}
            role="button"
            tabIndex={0}
          >
            <span className="sw" style={{ background: tag.color }} />
            {tag.name}
            <span className="count">{tag.count}</span>
          </div>
        ))
      )}

      <div className="side-head">Purge State</div>
      <div className="side-item">
        <span className="sw" style={{ background: "#7ddc83" }} />
        Keep
        <span className="count">{counts.keep}</span>
      </div>
      <div className="side-item">
        <span className="sw" style={{ background: "#e5705b" }} />
        Reject
        <span className="count">{counts.reject}</span>
      </div>
      <div className="side-item">
        <span className="sw" style={{ background: "#f2b84b" }} />
        Maybe
        <span className="count">{counts.maybe}</span>
      </div>

      <div className="side-head">Holding</div>
      {activeHolding.length === 0 ? (
        <div className="side-empty">No files in holding</div>
      ) : (
        activeHolding.slice(0, 5).map((batch) => (
          <div key={batch.id} className="side-item side-item-holding">
            <span className="sw" style={{ background: "#555b66" }} />
            <span className="side-source-name">{batch.label}</span>
            <span className="count">{batch.itemIds.length}</span>
            <button
              type="button"
              className="side-restore"
              title="Restore batch"
              onClick={() => void restoreHoldingBatchById(batch.id)}
            >
              ↩
            </button>
          </div>
        ))
      )}
    </aside>
  );
}
