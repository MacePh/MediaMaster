import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect } from "react";
import type { MockMediaItem } from "../../lib/types";

interface MediaViewerModalProps {
  open: boolean;
  items: MockMediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (itemId: string) => void;
}

function previewSrc(item: MockMediaItem): string | null {
  const path = item.filePath || item.thumbPath;
  return path ? convertFileSrc(path) : null;
}

export function MediaViewerModal({
  open,
  items,
  index,
  onClose,
  onNavigate,
}: MediaViewerModalProps) {
  const item = items[index] ?? null;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft" && hasPrev) {
        const prev = items[index - 1];
        if (prev) {
          onNavigate(prev.id);
        }
      }
      if (event.key === "ArrowRight" && hasNext) {
        const next = items[index + 1];
        if (next) {
          onNavigate(next.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, items, hasPrev, hasNext, onClose, onNavigate]);

  if (!open || !item) {
    return null;
  }

  const src = previewSrc(item);

  return (
    <div className="viewer-backdrop" onClick={onClose} role="presentation">
      <div className="viewer-shell" onClick={(event) => event.stopPropagation()}>
        <button className="viewer-close btn" type="button" onClick={onClose}>
          ✕
        </button>
        <div className="viewer-stage">
          {hasPrev ? (
            <button
              className="viewer-nav prev btn"
              type="button"
              onClick={() => onNavigate(items[index - 1]!.id)}
            >
              ‹
            </button>
          ) : null}
          {src ? (
            <img src={src} alt={item.name} className="viewer-image" />
          ) : (
            <div className="viewer-empty">No preview available</div>
          )}
          {hasNext ? (
            <button
              className="viewer-nav next btn"
              type="button"
              onClick={() => onNavigate(items[index + 1]!.id)}
            >
              ›
            </button>
          ) : null}
        </div>
        <div className="viewer-cap">
          <div className="fn">{item.name}</div>
          <div className="muted">
            {index + 1} / {items.length} · {item.dim} · {item.sizeLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
