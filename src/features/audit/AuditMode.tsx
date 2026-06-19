import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";

const AUDIT_CARDS = [
  {
    id: "untagged",
    count: 420,
    label: "Untagged AI renders",
    detail: "Likely ComfyUI outputs with no subject or dataset tag yet.",
    tone: "action" as const,
    action: "tagging" as const,
    button: "Open Tagging Mode",
    primary: true,
  },
  {
    id: "large-videos",
    count: 184,
    label: "Large videos",
    detail: "Videos over 1 GB. Good candidates for archive compression.",
    tone: "warn" as const,
    action: "browse" as const,
    button: "Review in Grid",
    primary: false,
  },
  {
    id: "huge-pngs",
    count: 62,
    label: "Huge PNG files",
    detail: "Images over 20 MB. Convert keepers to WebP or archive originals.",
    tone: "action" as const,
    action: "browse" as const,
    button: "Convert to WebP",
    primary: false,
  },
  {
    id: "rejects",
    count: 0,
    label: "Rejects waiting",
    detail: "Purge decisions exist, but files have not been moved to holding.",
    tone: "action" as const,
    action: "safe_delete" as const,
    button: "Open Safe Delete",
    primary: true,
  },
  {
    id: "duplicates",
    count: 31,
    label: "Duplicate candidates",
    detail:
      "Likely duplicates based on size, dimensions, name similarity, and modified time.",
    tone: "default" as const,
    action: "browse" as const,
    button: "Compare",
    primary: false,
  },
  {
    id: "not-hevc",
    count: 19,
    label: "Not H.265",
    detail: "Video files still using H.264 or older codecs.",
    tone: "default" as const,
    action: "browse" as const,
    button: "Compress for Archive",
    primary: false,
  },
];

export function AuditMode() {
  const setMode = useAppStore((state) => state.setMode);
  const rejectCount = useLibraryStore(
    (state) => state.items.filter((item) => item.state === "reject").length,
  );

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Media Audit</div>
        <div className="muted">
          Cleanup opportunities generated from the local SQLite catalog
        </div>
        <div className="spacer" />
        <button className="btn primary" type="button" disabled>
          Run Audit
        </button>
      </div>

      <div className="audit-grid">
        {AUDIT_CARDS.map((card) => {
          const count = card.id === "rejects" ? rejectCount : card.count;

          return (
            <div
              key={card.id}
              className={`audit-card ${card.tone === "action" ? "action" : card.tone === "warn" ? "warn" : ""}`}
            >
              <div className="num">{count}</div>
              <div className="label">{card.label}</div>
              <p>{card.detail}</p>
              <button
                className={`btn ${card.primary ? "primary" : ""}`}
                type="button"
                onClick={() => setMode(card.action)}
              >
                {card.button}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
