import type { MockMediaItem } from "../../lib/types";
import { MediaTile } from "./MediaTile";

interface MediaGridProps {
  items: MockMediaItem[];
  onToggle: (id: string) => void;
  className?: string;
}

export function MediaGrid({ items, onToggle, className }: MediaGridProps) {
  if (items.length === 0) {
    return <div className="empty">No media items match the current filter.</div>;
  }

  return (
    <div className={`grid ${className ?? ""}`.trim()}>
      {items.map((item) => (
        <MediaTile key={item.id} item={item} onToggle={onToggle} />
      ))}
    </div>
  );
}
