import { useEffect, useRef } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { MockMediaItem } from "../../lib/types";
import { copyImageToClipboard } from "../../lib/tauri";
import { useAppStore } from "../../stores/appStore";

interface MediaContextMenuProps {
  item: MockMediaItem | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function MediaContextMenu({ item, position, onClose }: MediaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const showToast = useAppStore((state) => state.showToast);

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
      <button type="button" className="ctx-item" role="menuitem" onClick={() => void copyImage()}>
        Copy image
      </button>
    </div>
  );
}
