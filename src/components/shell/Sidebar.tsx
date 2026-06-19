import { useLibraryStore } from "../../stores/libraryStore";

export function Sidebar() {
  const sources = useLibraryStore((state) => state.sources);
  const tags = useLibraryStore((state) => state.tags);
  const activeSourceId = useLibraryStore((state) => state.activeSourceId);
  const setActiveSource = useLibraryStore((state) => state.setActiveSource);
  const purgeCounts = useLibraryStore((state) => state.purgeCounts);

  const counts = purgeCounts();

  return (
    <aside className="side">
      <div className="side-head">Sources</div>
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
      {tags.map((tag) => (
        <div key={tag.id} className="side-item">
          <span className="sw" style={{ background: tag.color }} />
          {tag.name}
          <span className="count">{tag.count}</span>
        </div>
      ))}

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
