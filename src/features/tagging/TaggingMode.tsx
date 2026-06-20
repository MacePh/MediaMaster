import { useEffect, useState } from "react";
import { MediaGrid } from "../../components/media/MediaGrid";
import { useVisibleItems, useSelectedCount } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";

export function TaggingMode() {
  const showToast = useAppStore((state) => state.showToast);
  const visibleItems = useVisibleItems();
  const tags = useLibraryStore((state) => state.tags);
  const selectedCount = useSelectedCount();
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const assignTagToSelected = useLibraryStore((state) => state.assignTagToSelected);
  const createTagByName = useLibraryStore((state) => state.createTagByName);
  const selectUntaggedVisible = useLibraryStore((state) => state.selectUntaggedVisible);
  const [newTagName, setNewTagName] = useState("");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  useEffect(() => {
    if (tags.length === 0) {
      setActiveTagId(null);
      return;
    }

    if (!activeTagId || !tags.some((tag) => tag.id === activeTagId)) {
      setActiveTagId(tags[0]?.id ?? null);
    }
  }, [tags, activeTagId]);

  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null;

  const assignTag = async () => {
    if (!activeTagId) {
      showToast("Create or select a tag first");
      return;
    }

    const count = await assignTagToSelected(activeTagId);
    if (count === 0) {
      showToast("Select thumbnails to tag");
      return;
    }

    showToast(`Assigned ${count} items to ${activeTag?.name ?? "tag"}`);
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      showToast("Enter a tag name");
      return;
    }

    const tag = await createTagByName(name);
    setNewTagName("");
    setActiveTagId(tag.id);
    showToast(`Created tag ${tag.name}`);
  };

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Bulk Tagging Mode</div>
        <div className="muted">Click thumbnails to select, then assign a tag</div>
        <div className="spacer" />
        {activeTag ? (
          <div className="muted">Active tag: {activeTag.name}</div>
        ) : (
          <div className="muted">No tag selected</div>
        )}
      </div>

      <div className="tag-layout">
        <div className="grid-wrap">
          <MediaGrid
            items={visibleItems}
            onToggle={(id) => toggleSelection(id)}
            className="tagging-grid"
            interaction="bulk-select"
          />
        </div>

        <aside className="tag-panel">
          <div className="section">Selection</div>
          <div className="summary-card">
            <div className="num">{selectedCount}</div>
            <div className="muted">selected for tag assignment</div>
          </div>

          <button
            className="btn primary"
            style={{ width: "100%", textAlign: "center", marginBottom: 10 }}
            type="button"
            disabled={!activeTagId || selectedCount === 0}
            onClick={() => void assignTag()}
          >
            Assign to {activeTag?.name ?? "Tag"}
          </button>

          <button
            className="btn"
            style={{ width: "100%", textAlign: "center", marginBottom: 16 }}
            type="button"
            onClick={() => {
              selectUntaggedVisible();
              showToast("Selected visible untagged items");
            }}
          >
            Select visible untagged
          </button>

          <div className="section">Create Tag</div>
          <input
            className="input"
            placeholder="New tag name"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateTag();
              }
            }}
          />
          <button
            className="btn"
            style={{ width: "100%", textAlign: "center", marginTop: 10, marginBottom: 16 }}
            type="button"
            onClick={() => void handleCreateTag()}
          >
            Create Tag
          </button>

          <div className="section">Tags</div>
          {tags.length === 0 ? (
            <div className="side-empty">Create a tag to start assigning subjects.</div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className={`tag-row ${activeTagId === tag.id ? "active" : ""}`}
                onClick={() => setActiveTagId(tag.id)}
                onDoubleClick={() => {
                  void (async () => {
                    setActiveTagId(tag.id);
                    const count = await assignTagToSelected(tag.id);
                    if (count === 0) {
                      showToast("Select thumbnails to tag");
                      return;
                    }
                    showToast(`Assigned ${count} items to ${tag.name}`);
                  })();
                }}
                role="button"
                tabIndex={0}
              >
                <span className="sw" style={{ background: tag.color }} />
                {tag.name}
                <span className="count">{tag.count}</span>
                {tag.hotkey ? <span className="hot">{tag.hotkey}</span> : null}
              </div>
            ))
          )}
        </aside>
      </div>
    </section>
  );
}
