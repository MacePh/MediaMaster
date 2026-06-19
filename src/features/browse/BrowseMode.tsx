import { MediaGrid } from "../../components/media/MediaGrid";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePurgeStore } from "../../stores/purgeStore";

export function BrowseMode() {
  const setMode = useAppStore((state) => state.setMode);
  const visibleItems = useLibraryStore((state) => state.visibleItems());
  const selectedCount = useLibraryStore((state) => state.selectedCount());
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const startSession = usePurgeStore((state) => state.startSession);
  const items = useLibraryStore((state) => state.items);

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
        <MediaGrid items={visibleItems} onToggle={toggleSelection} />
      </div>
    </section>
  );
}
