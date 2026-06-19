import { usePurgeCounts } from "../../hooks/useLibrarySelectors";
import { useLibraryStore } from "../../stores/libraryStore";

export function Sidebar() {
  const sources = useLibraryStore((state) => state.sources);
  const tags = useLibraryStore((state) => state.tags);
  const activeSourceId = useLibraryStore((state) => state.activeSourceId);
  const scanningSourceId = useLibraryStore((state) => state.scanningSourceId);
  const scanProgress = useLibraryStore((state) => state.scanProgress);
  const loading = useLibraryStore((state) => state.loading);
  const setActiveSource = useLibraryStore((state) => state.setActiveSource);
  const addSourceFromDialog = useLibraryStore((state) => state.addSourceFromDialog);
  const counts = usePurgeCounts();

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

      {scanningLabel ? (
        <div className="side-scan">{scanningLabel}</div>
      ) : null}

      {sources.map((source) => (
        <div
          key={source.id}
          className={`side-item ${activeSourceId === source.id ? "active" : ""}`}
          onClick={() => setActiveSource(source.id)}
          role="button"
          tabIndex={0}
        >
          <span className="sw" style={{ background: source.color }} />
          {source.name}
          <span className="count">{source.count.toLocaleString()}</span>
        </div>
      ))}

      <div className="side-head">Tags</div>
      {tags.length === 0 ? (
        <div className="side-empty">No tags yet</div>
      ) : (
        tags.map((tag) => (
          <div key={tag.id} className="side-item">
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
      <div className="side-item">
        <span className="sw" style={{ background: "#555b66" }} />
        Pending final review
        <span className="count">0</span>
      </div>
    </aside>
  );
}
