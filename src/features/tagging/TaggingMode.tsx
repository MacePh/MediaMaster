import { useState } from "react";
import { MediaGrid } from "../../components/media/MediaGrid";
import { useVisibleItems, useSelectedCount } from "../../hooks/useLibrarySelectors";
import { useAppStore } from "../../stores/appStore";
import { useJobsStore } from "../../stores/jobsStore";
import { useLibraryStore } from "../../stores/libraryStore";

export function TaggingMode() {
  const showToast = useAppStore((state) => state.showToast);
  const addJob = useJobsStore((state) => state.addJob);
  const visibleItems = useVisibleItems();
  const tags = useLibraryStore((state) => state.tags);
  const selectedCount = useSelectedCount();
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const assignTagToSelected = useLibraryStore((state) => state.assignTagToSelected);
  const selectUntaggedVisible = useLibraryStore((state) => state.selectUntaggedVisible);
  const [newTagName, setNewTagName] = useState("new-subject-tag");
  const [activeTag, setActiveTag] = useState("Subject A");

  const assignTag = (tagName: string) => {
    assignTagToSelected(tagName);
    const count = useLibraryStore.getState().items.filter((item) => item.selected).length;
    addJob(`Assign tag: ${tagName}`, `${count} files`);
    showToast(`Assigned ${count} items to ${tagName}`);
  };

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Bulk Tagging Mode</div>
        <div className="muted">Large thumbnails · click to select · assign subjects manually</div>
        <div className="spacer" />
        <select className="select" defaultValue="untagged">
          <option value="untagged">Filter: Untagged AI renders</option>
          <option value="keepers">Filter: Keepers only</option>
          <option value="rejects">Filter: Rejects</option>
        </select>
      </div>

      <div className="tag-layout">
        <div className="grid-wrap">
          <MediaGrid
            items={visibleItems}
            onToggle={toggleSelection}
            className="tagging-grid"
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
            onClick={() => assignTag(activeTag)}
          >
            Assign to Tag
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

          <div className="section">Tags</div>
          <input
            className="input"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
          />
          <div style={{ height: 10 }} />

          {tags.map((tag) => (
            <div
              key={tag.id}
              className="tag-row"
              onClick={() => setActiveTag(tag.name)}
              role="button"
              tabIndex={0}
            >
              <span className="sw" style={{ background: tag.color }} />
              {tag.name}
              {tag.hotkey ? <span className="hot">{tag.hotkey}</span> : null}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
