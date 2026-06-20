import { useMemo } from "react";
import { useLibraryStore } from "../stores/libraryStore";
import type { MockMediaItem } from "../lib/types";

export function useVisibleItems(): MockMediaItem[] {
  return useLibraryStore((state) => state.items);
}

export function useSelectedCount(): number {
  return useLibraryStore((state) => {
    const ids = new Set<string>();
    for (const item of state.items) {
      if (item.selected) {
        ids.add(item.id);
      }
    }
    for (const item of state.rejectItems) {
      if (item.selected) {
        ids.add(item.id);
      }
    }
    return ids.size;
  });
}

export function useRejectedItems(): MockMediaItem[] {
  return useLibraryStore((state) => state.rejectItems);
}

export function usePurgeCounts(): { keep: number; reject: number; maybe: number } {
  const items = useLibraryStore((state) => state.items);

  return useMemo(
    () => ({
      keep: items.filter((item) => item.state === "keep").length,
      reject: items.filter((item) => item.state === "reject").length,
      maybe: items.filter((item) => item.state === "maybe").length,
    }),
    [items],
  );
}
