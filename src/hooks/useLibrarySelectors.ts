import { useMemo } from "react";
import { mockSources } from "../lib/mockData";
import { useLibraryStore } from "../stores/libraryStore";
import type { MockMediaItem } from "../lib/types";

export function useVisibleItems(): MockMediaItem[] {
  const items = useLibraryStore((state) => state.items);
  const activeSourceId = useLibraryStore((state) => state.activeSourceId);
  const search = useLibraryStore((state) => state.search);

  return useMemo(() => {
    return items.filter((item) => {
      const matchesSource =
        activeSourceId === "all" ||
        item.sourceName ===
          mockSources.find((source) => source.id === activeSourceId)?.name;
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.tag.toLowerCase().includes(search.toLowerCase());
      return matchesSource && matchesSearch;
    });
  }, [items, activeSourceId, search]);
}

export function useSelectedCount(): number {
  return useLibraryStore((state) => state.items.filter((item) => item.selected).length);
}

export function useRejectedItems(): MockMediaItem[] {
  const items = useLibraryStore((state) => state.items);

  return useMemo(
    () => items.filter((item) => item.state === "reject"),
    [items],
  );
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
