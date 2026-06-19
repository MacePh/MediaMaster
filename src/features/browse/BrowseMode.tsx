import { MediaGrid } from "../../components/media/MediaGrid";
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
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const addSourceFromDialog = useLibraryStore((state) => state.addSourceFromDialog);
  const startSession = usePurgeStore((state) => state.startSession);
  const items = useLibraryStore((state) => state.items);

  const hasSources = sources.length > 1;

  const startPurge = () => {
    const selected = items.filter((item) => item.selected && item.kind === "image");
    const sessionItems = selected.length > 0 ? selected : visibleItems.filter((item) => item.kind === "image");
    startSession(sessionItems);
    setMode("purge");
  };

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Browse Mode</div>
        <div className="muted">
          Unified grid · {visibleItems.length} items · {selectedCount} selected
        </div>
        <div className="spacer" />
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
          <MediaGrid items={visibleItems} onToggle={toggleSelection} />
        )}
      </div>
    </section>
  );
}
