import type { MockMediaItem } from "../../lib/types";
import { MediaTile, type TileInteraction } from "./MediaTile";

interface MediaGridProps {
  items: MockMediaItem[];
  className?: string;
  interaction?: TileInteraction;
  focusedId?: string | null;
  selectMode?: boolean;
  onFocus?: (id: string) => void;
  onToggle?: (id: string, shiftKey: boolean) => void;
  onOpen?: (id: string) => void;
  onCheckbox?: (id: string, shiftKey: boolean) => void;
  onContextMenu?: (item: MockMediaItem, position: { x: number; y: number }) => void;
}

export function MediaGrid({
  items,
  className,
  interaction = "bulk-select",
  focusedId = null,
  selectMode = false,
  onFocus,
  onToggle,
  onOpen,
  onCheckbox,
  onContextMenu,
}: MediaGridProps) {
  if (items.length === 0) {
    return <div className="empty">No media items match the current filter.</div>;
  }

  return (
    <div className={`grid ${className ?? ""}`.trim()}>
      {items.map((item) => (
        <MediaTile
          key={item.id}
          item={item}
          interaction={interaction}
          focused={focusedId === item.id}
          selectMode={selectMode}
          onFocus={onFocus}
          onToggle={onToggle}
          onOpen={onOpen}
          onCheckbox={onCheckbox}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
