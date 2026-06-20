import { convertFileSrc } from "@tauri-apps/api/core";
import { useRef } from "react";
import type { MockMediaItem } from "../../lib/types";
import { gradientForHue } from "../../lib/mockData";
import { TagChip } from "../shared/TagChip";

export type TileInteraction = "browse" | "bulk-select";

interface MediaTileProps {
  item: MockMediaItem;
  interaction?: TileInteraction;
  focused?: boolean;
  selectMode?: boolean;
  onFocus?: (id: string) => void;
  onToggle?: (id: string, shiftKey: boolean) => void;
  onOpen?: (id: string) => void;
  onCheckbox?: (id: string, shiftKey: boolean) => void;
}

export function MediaTile({
  item,
  interaction = "bulk-select",
  focused = false,
  selectMode = false,
  onFocus,
  onToggle,
  onOpen,
  onCheckbox,
}: MediaTileProps) {
  const thumbSrc = item.thumbPath ? convertFileSrc(item.thumbPath) : null;
  const clickTimerRef = useRef<number | null>(null);

  const handleTileClick = () => {
    if (interaction === "browse") {
      if (selectMode) {
        return;
      }

      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        onFocus?.(item.id);
      }, 220);
      return;
    }

    onToggle?.(item.id, false);
  };

  const handleTileSelectClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggle?.(item.id, event.shiftKey);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    if (interaction === "browse") {
      onOpen?.(item.id);
    }
  };

  const handleCheckboxClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onCheckbox?.(item.id, event.shiftKey);
  };

  return (
    <div
      className={`tile ${item.selected ? "sel" : ""} ${focused ? "focused" : ""} ${selectMode ? "select-mode" : ""}`}
      onClick={selectMode ? handleTileSelectClick : handleTileClick}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selectMode) {
            onToggle?.(item.id, event.shiftKey);
          } else {
            handleTileClick();
          }
        }
      }}
    >
      <div
        className="thumb"
        style={thumbSrc ? undefined : { background: gradientForHue(item.hue) }}
      >
        {thumbSrc ? <img src={thumbSrc} alt="" className="thumb-img" /> : null}
        {interaction === "browse" ? (
          <button
            type="button"
            className={`tile-checkbox ${item.selected ? "on" : ""}`}
            aria-label={item.selected ? "Deselect" : "Select"}
            onClick={handleCheckboxClick}
          >
            {item.selected ? "✓" : ""}
          </button>
        ) : null}
        <span className="badge">{item.ext}</span>
        <span className={`state ${item.state}`}>{item.state}</span>
        {interaction === "bulk-select" ? <span className="check">✓</span> : null}
      </div>
      <div className="cap">
        <div className="fn">{item.name}</div>
        <div className="sub">
          {item.dim} · {item.sizeLabel}
        </div>
        <div className="chips">
          {item.tags.length > 0 ? (
            item.tags.map((tag) => <TagChip key={tag} label={tag} tone="teal" />)
          ) : (
            <TagChip label="untagged" />
          )}
          {item.state === "keep" ? <TagChip label="keeper" tone="amber" /> : null}
        </div>
      </div>
    </div>
  );
}
