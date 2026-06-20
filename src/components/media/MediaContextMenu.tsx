import { useEffect, useRef } from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { MockMediaItem } from "../../lib/types";
import { copyImageToClipboard, openInVlc } from "../../lib/tauri";
import { useAppStore } from "../../stores/appStore";

interface MediaContextMenuProps {
  item: MockMediaItem | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function MediaContextMenu({ item, position, onClose }: MediaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const showToast = useAppStore((state) => state.showToast);
  const vlcAvailable = useAppStore((state) => state.vlcReady);

  useEffect(() => {
    if (!position) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [position, onClose]);

  if (!item || !position) {
    return null;
  }

  const filePath = item.filePath;
  const copyPath = item.filePath || item.thumbPath;
  const isVideo = item.kind === "video";

  const revealInExplorer = async () => {
    if (!filePath) {
      showToast("Original file path unavailable");
      onClose();
      return;
    }

    try {
      await revealItemInDir(filePath);
    } catch {
      showToast("Could not open Explorer for this file");
    }
    onClose();
  };

  const playInDefaultApp = async () => {
    if (!filePath) {
      showToast("Original file path unavailable");
      onClose();
      return;
    }

    try {
      await openPath(filePath);
    } catch {
      showToast("Could not open file in default app");
    }
    onClose();
  };

  const playInVlc = async () => {
    if (!filePath) {
      showToast("Original file path unavailable");
      onClose();
      return;
    }

    try {
      await openInVlc(filePath);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not open in VLC");
    }
    onClose();
  };

  const copyImage = async () => {
    if (!copyPath) {
      showToast("No image available to copy");
      onClose();
      return;
    }

    try {
      await copyImageToClipboard(copyPath);
      showToast(`Copied ${item.name} to clipboard`);
    } catch {
      showToast("Could not copy image to clipboard");
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      <button type="button" className="ctx-item" role="menuitem" onClick={() => void revealInExplorer()}>
        Reveal in Explorer
      </button>
      {isVideo ? (
        <>
          <button type="button" className="ctx-item" role="menuitem" onClick={() => void playInDefaultApp()}>
            Play in default app
          </button>
          {vlcAvailable ? (
            <button type="button" className="ctx-item" role="menuitem" onClick={() => void playInVlc()}>
              Open in VLC
            </button>
          ) : null}
        </>
      ) : (
        <button type="button" className="ctx-item" role="menuitem" onClick={() => void copyImage()}>
          Copy image
        </button>
      )}
    </div>
  );
}
