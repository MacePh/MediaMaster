import { useEffect, useRef, useState } from "react";
import { MediaGrid } from "../../components/media/MediaGrid";
import { MediaContextMenu } from "../../components/media/MediaContextMenu";
import { MediaViewerModal } from "../../components/media/MediaViewerModal";
import { useVisibleItems, useSelectedCount } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePurgeStore } from "../../stores/purgeStore";
import type { MockMediaItem } from "../../lib/types";

export function BrowseMode() {
  const setMode = useAppStore((state) => state.setMode);
  const visibleItems = useVisibleItems();
  const selectedCount = useSelectedCount();
  const loading = useLibraryStore((state) => state.loading);
  const refreshingMedia = useLibraryStore((state) => state.refreshingMedia);
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
  const mediaTotal = useLibraryStore((state) => state.mediaTotal);
  const mediaHasMore = useLibraryStore((state) => state.mediaHasMore);
  const loadingMore = useLibraryStore((state) => state.loadingMore);
  const loadMoreMedia = useLibraryStore((state) => state.loadMoreMedia);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    item: MockMediaItem;
    position: { x: number; y: number };
  } | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const hasSources = sources.length > 1;
  const viewerIndex = viewerId
    ? visibleItems.findIndex((item) => item.id === viewerId)
    : -1;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !mediaHasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreMedia();
        }
      },
      { root: null, rootMargin: "240px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mediaHasMore, loadMoreMedia, visibleItems.length]);

  const openViewer = (itemId: string) => {
    setFocusedItem(itemId);
    setViewerId(itemId);
  };

  const openContextMenu = (item: MockMediaItem, position: { x: number; y: number }) => {
    setContextMenu({ item, position });
  };

  const startPurge = () => {
    const selected = items.filter((item) => item.selected && item.kind === "image");
    const sessionItems = selected.length > 0 ? selected : visibleItems.filter((item) => item.kind === "image");
    startSession(sessionItems);
    setMode("purge");
  };

  const showSelectionBar = selectMode || selectedCount > 0;
  const showGrid = hasSources && (visibleItems.length > 0 || refreshingMedia);

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Browse Mode</div>
        <div className="muted">
          {visibleItems.length.toLocaleString()}
          {mediaTotal > visibleItems.length
            ? ` of ${mediaTotal.toLocaleString()}`
            : mediaTotal > 0 && visibleItems.length === mediaTotal
              ? ` total`
              : ""}{" "}
          items
          {loadingMore ? " · loading more…" : null}
          {refreshingMedia ? " · updating…" : null}
        </div>
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
        ) : !showGrid ? (
          <div className="empty-state">
            <div className="empty-title">No media in this view</div>
            <div className="muted">Try another source or add a folder with supported images and videos.</div>
          </div>
        ) : (
          <div className={`grid-stack ${refreshingMedia ? "refreshing" : ""}`}>
            <MediaGrid
              items={visibleItems}
              interaction="browse"
              focusedId={focusedItemId}
              selectMode={selectMode}
              onFocus={setFocusedItem}
              onToggle={browseToggleSelect}
              onOpen={openViewer}
              onCheckbox={browseCheckboxSelect}
              onContextMenu={openContextMenu}
            />
            {mediaHasMore ? (
              <div ref={loadMoreSentinelRef} className="load-more-wrap">
                <button
                  className="btn"
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMoreMedia()}
                >
                  {loadingMore ? "Loading…" : `Load more (${(mediaTotal - visibleItems.length).toLocaleString()} remaining)`}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MediaContextMenu
        item={contextMenu?.item ?? null}
        position={contextMenu?.position ?? null}
        onClose={() => setContextMenu(null)}
      />

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
