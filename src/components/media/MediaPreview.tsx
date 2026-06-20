import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { openInVlc } from "../../lib/tauri";
import type { MockMediaItem } from "../../lib/types";

export interface MediaPreviewItem {
  kind: MockMediaItem["kind"];
  name: string;
  filePath: string;
  thumbPath?: string | null;
}

interface MediaPreviewProps {
  item: MediaPreviewItem;
  imageClassName?: string;
  videoClassName?: string;
  emptyClassName?: string;
  vlcAvailable?: boolean;
}

function mediaSrc(item: MediaPreviewItem): string | null {
  const path = item.kind === "video" ? item.filePath : item.filePath || item.thumbPath;
  return path ? convertFileSrc(path) : null;
}

export function MediaPreview({
  item,
  imageClassName = "",
  videoClassName = "",
  emptyClassName = "viewer-empty",
  vlcAvailable = false,
}: MediaPreviewProps) {
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const src = mediaSrc(item);

  useEffect(() => {
    setPlaybackFailed(false);
  }, [item.filePath, item.kind]);

  if (!src) {
    return <div className={emptyClassName}>No preview available</div>;
  }

  if (item.kind === "image") {
    return <img src={src} alt={item.name} className={imageClassName} />;
  }

  if (playbackFailed) {
    return (
      <div className="media-preview-fallback">
        <p>Cannot play in app — open externally?</p>
        <div className="media-preview-fallback-actions">
          <button
            className="btn"
            type="button"
            onClick={() => void openPath(item.filePath)}
          >
            Open in default app
          </button>
          {vlcAvailable ? (
            <button
              className="btn primary"
              type="button"
              onClick={() => void openInVlc(item.filePath)}
            >
              Open in VLC
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <video
      key={item.filePath}
      className={videoClassName}
      src={src}
      controls
      playsInline
      preload="metadata"
      onError={() => setPlaybackFailed(true)}
    />
  );
}

export function isVideoFocused(): boolean {
  return document.activeElement instanceof HTMLVideoElement;
}
