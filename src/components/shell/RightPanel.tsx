import { convertFileSrc } from "@tauri-apps/api/core";
import { TagChip } from "../shared/TagChip";
import { usePurgeSessionCounts } from "../../hooks/usePurgeSelectors";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";

function BrowseInspectorContent({ itemId }: { itemId: string }) {
  const item = useLibraryStore((state) =>
    state.items.find((entry) => entry.id === itemId),
  );

  if (!item) {
    return <div className="empty">No media selected.</div>;
  }

  const previewPath = item.filePath || item.thumbPath;
  const previewSrc = previewPath ? convertFileSrc(previewPath) : null;
  const usesGradientPreview = !previewSrc;

  return (
    <div className="panel-pad">
      <div
        className="preview"
        style={
          usesGradientPreview
            ? {
                background: `linear-gradient(135deg, hsl(${item.hue} 42% 34%), hsl(${(item.hue + 48) % 360} 40% 15%))`,
              }
            : undefined
        }
      >
        {previewSrc ? (
          <img src={previewSrc} alt={item.name} className="preview-img" />
        ) : null}
        <span className="badge">{item.ext}</span>
      </div>
      <div className="fn" style={{ marginBottom: 10 }}>
        {item.name}
      </div>
      <table className="meta-table">
        <tbody>
          <tr>
            <td className="k">State</td>
            <td className="v">{item.state}</td>
          </tr>
          <tr>
            <td className="k">Tag</td>
            <td className="v">{item.tag || "untagged"}</td>
          </tr>
          <tr>
            <td className="k">Source</td>
            <td className="v">{item.sourceName}</td>
          </tr>
          <tr>
            <td className="k">Dims</td>
            <td className="v">{item.dim}</td>
          </tr>
          <tr>
            <td className="k">Size</td>
            <td className="v">{item.sizeLabel}</td>
          </tr>
        </tbody>
      </table>
      <div className="section">Operations</div>
      <div className="op-grid">
        <div className="op-card">
          <div className="t">Compress archive</div>
          <div className="d">Coming in Slice 8</div>
        </div>
        <div className="op-card">
          <div className="t">Make proxy</div>
          <div className="d">Coming in Slice 8</div>
        </div>
        <div className="op-card">
          <div className="t">Images to WebP</div>
          <div className="d">Coming in Slice 8</div>
        </div>
        <div className="op-card">
          <div className="t">Extract frames</div>
          <div className="d">Coming in Slice 8</div>
        </div>
      </div>
    </div>
  );
}

function PurgeInspector() {
  const counts = usePurgeSessionCounts();

  return (
    <div className="panel-pad">
      <div className="section">Purge Summary</div>
      <table className="meta-table">
        <tbody>
          <tr>
            <td className="k">Keep</td>
            <td className="v" style={{ color: "var(--green)" }}>
              {counts.keep}
            </td>
          </tr>
          <tr>
            <td className="k">Reject</td>
            <td className="v" style={{ color: "var(--danger)" }}>
              {counts.reject}
            </td>
          </tr>
          <tr>
            <td className="k">Maybe</td>
            <td className="v">{counts.maybe}</td>
          </tr>
          <tr>
            <td className="k">Undo stack</td>
            <td className="v">available</td>
          </tr>
        </tbody>
      </table>
      <div className="section">Rule</div>
      <p className="muted" style={{ lineHeight: 1.5 }}>
        Swipe left only marks reject. It never deletes. Deletion happens later
        through Safe Delete.
      </p>
    </div>
  );
}

export function RightPanel() {
  const mode = useAppStore((state) => state.mode);
  const focusedItemId = useLibraryStore((state) => state.focusedItemId);
  const fallbackId = useLibraryStore((state) => state.items[0]?.id ?? null);
  const inspectorId = focusedItemId ?? fallbackId;

  return (
    <aside className="right">
      {mode === "browse" && inspectorId ? (
        <BrowseInspectorContent itemId={inspectorId} />
      ) : null}
      {mode === "purge" ? <PurgeInspector /> : null}
      {mode === "tagging" ? (
        <div className="panel-pad">
          <div className="section">Tagging Workflow</div>
          <p className="muted" style={{ lineHeight: 1.5 }}>
            This is separate from Purge Mode. Click thumbnails, then assign a
            subject/project/dataset tag in bulk.
          </p>
          <div className="section">Useful filters</div>
          <TagChip label="untagged" /> <TagChip label="keepers" />{" "}
          <TagChip label="AI renders" />
        </div>
      ) : null}
      {mode === "safe_delete" ? (
        <div className="panel-pad">
          <div className="section">Safety Model</div>
          <p className="muted" style={{ lineHeight: 1.5 }}>
            Rejects first move to a holding folder. You can browse that folder,
            rescue files, restore all, or final delete later.
          </p>
        </div>
      ) : null}
      {mode === "audit" ? (
        <div className="panel-pad">
          <div className="section">Audit Actions</div>
          <p className="muted" style={{ lineHeight: 1.5 }}>
            Audit cards should open the right workflow instead of dumping users
            into a generic report.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
