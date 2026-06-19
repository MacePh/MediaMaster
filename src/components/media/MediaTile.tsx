import type { MockMediaItem } from "../../lib/types";
import { gradientForHue } from "../../lib/mockData";
import { TagChip } from "../shared/TagChip";

interface MediaTileProps {
  item: MockMediaItem;
  onToggle: (id: string) => void;
}

export function MediaTile({ item, onToggle }: MediaTileProps) {
  return (
    <div
      className={`tile ${item.selected ? "sel" : ""}`}
      onClick={() => onToggle(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(item.id);
        }
      }}
    >
      <div className="thumb" style={{ background: gradientForHue(item.hue) }}>
        <span className="badge">{item.ext}</span>
        <span className={`state ${item.state}`}>{item.state}</span>
        <span className="check">✓</span>
      </div>
      <div className="cap">
        <div className="fn">{item.name}</div>
        <div className="sub">
          {item.dim} · {item.sizeLabel}
        </div>
        <div className="chips">
          {item.tag ? (
            <TagChip label={item.tag} tone="teal" />
          ) : (
            <TagChip label="untagged" />
          )}
          {item.state === "keep" ? <TagChip label="keeper" tone="amber" /> : null}
        </div>
      </div>
    </div>
  );
}
