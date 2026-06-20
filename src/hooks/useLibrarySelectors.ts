import { useMemo } from "react";
import { useLibraryStore } from "../stores/libraryStore";
import type { MockMediaItem } from "../lib/types";

export function useVisibleItems(): MockMediaItem[] {
  return useLibraryStore((state) => state.items);
}

export function useSelectedCount(): number {
  return useLibraryStore((state) => state.items.filter((item) => item.selected).length);
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
