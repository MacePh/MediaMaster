import { useState } from "react";
import { MediaGrid } from "../../components/media/MediaGrid";
import { MediaViewerModal } from "../../components/media/MediaViewerModal";
import { useVisibleItems, useSelectedCount } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePurgeStore } from "../../stores/purgeStore";

export function BrowseMode() {
  const setMode = useAppStore((state) => state.setMode);
  const visibleItems = useVisibleItems();
  const selectedCount = useSelectedCount();
  const loading = useLibraryStore((state) => state.loading);
  const scanningSourceId = useLibraryStore((state) => state.scanningSourceId);
  const sources = useLibraryStore((state) => state.sources);
  const focusedItemId = useLibraryStore((state) => state.focusedItemId);
  const selectMode = useLibraryStore((state) => state.selectMode);
  const setFocusedItem = useLibraryStore((state) => state.setFocusedItem);
  const browseToggleSelect = useLibraryStore((state) => state.browseToggleSelect);
  const browseCheckboxSelect = useLibraryStore((state) => state.browseCheckboxSelect);
  const selectAllVisible = useLibraryStore((state) => state.selectAllVisible);
  const clearSelection = useLibraryStore((state) => state.clearSelection);
  const exitSelectMode = useLibraryStore((state) => state.exitSelectMode);
  const addSourceFromDialog = useLibraryStore((state) => state.addSourceFromDialog);
  const startSession = usePurgeStore((state) => state.startSession);
  const items = useLibraryStore((state) => state.items);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const hasSources = sources.length > 1;
  const viewerIndex = viewerId
    ? visibleItems.findIndex((item) => item.id === viewerId)
    : -1;

  const openViewer = (itemId: string) => {
    setFocusedItem(itemId);
    setViewerId(itemId);
  };

  const startPurge = () => {
    const selected = items.filter((item) => item.selected && item.kind === "image");
    const sessionItems = selected.length > 0 ? selected : visibleItems.filter((item) => item.kind === "image");
    startSession(sessionItems);
    setMode("purge");
  };

  const showSelectionBar = selectMode || selectedCount > 0;

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Browse Mode</div>
        <div className="muted">{visibleItems.length} items</div>
        <div className="spacer" />
        {showSelectionBar ? (
          <div className="selection-bar">
            <button className="btn btn-compact" type="button" onClick={selectAllVisible}>
              All
            </button>
            <span className="selection-sep" aria-hidden="true">·</span>
            <button className="btn btn-compact" type="button" onClick={clearSelection}>
              None
            </button>
            <span className="selection-count">{selectedCount} sel</span>
            <button className="btn btn-compact btn-compact-done" type="button" onClick={exitSelectMode}>
              Done
            </button>
          </div>
        ) : null}
        <button className="btn" type="button" onClick={startPurge}>
          Start Purge Mode
        </button>
        <button className="btn" type="button" onClick={() => setMode("tagging")}>
          Bulk Tagging
        </button>
        <button className="btn primary" type="button" disabled>
          Run Operation
        </button>
      </div>
      <div className="grid-wrap">
        {loading || scanningSourceId ? (
          <div className="empty-state">Loading catalog…</div>
        ) : !hasSources ? (
          <div className="empty-state">
            <div className="empty-title">No sources yet</div>
            <div className="muted">Add a folder to scan your media library.</div>
            <button className="btn primary" type="button" onClick={() => void addSourceFromDialog()}>
              Add Source Folder
            </button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No media in this view</div>
            <div className="muted">Try another source or add a folder with supported images and videos.</div>
          </div>
        ) : (
          <MediaGrid
            items={visibleItems}
            interaction="browse"
            focusedId={focusedItemId}
            selectMode={selectMode}
            onFocus={setFocusedItem}
            onToggle={browseToggleSelect}
            onOpen={openViewer}
            onCheckbox={browseCheckboxSelect}
          />
        )}
      </div>

      <MediaViewerModal
        open={viewerId !== null && viewerIndex >= 0}
        items={visibleItems}
        index={Math.max(viewerIndex, 0)}
        onClose={() => setViewerId(null)}
        onNavigate={(itemId) => {
          setViewerId(itemId);
          setFocusedItem(itemId);
        }}
      />
    </section>
  );
}
