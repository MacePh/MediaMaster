import { create } from "zustand";
import { createMockMediaItems, mockSources, mockTags } from "../lib/mockData";
import type { MockMediaItem, MockSource, MockTag } from "../lib/types";

interface LibraryState {
  items: MockMediaItem[];
  sources: MockSource[];
  tags: MockTag[];
  activeSourceId: string;
  search: string;
  setSearch: (search: string) => void;
  setActiveSource: (sourceId: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAllVisible: () => void;
  invertVisibleSelection: () => void;
  selectUntaggedVisible: () => void;
  updateItemState: (id: string, state: MockMediaItem["state"]) => void;
  assignTagToSelected: (tagName: string) => void;
  visibleItems: () => MockMediaItem[];
  selectedCount: () => number;
  purgeCounts: () => { keep: number; reject: number; maybe: number };
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: createMockMediaItems(),
  sources: mockSources,
  tags: mockTags,
  activeSourceId: "all",
  search: "",
  setSearch: (search) => set({ search }),
  setActiveSource: (activeSourceId) => set({ activeSourceId }),
  toggleSelection: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    })),
  clearSelection: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, selected: false })),
    })),
  selectAllVisible: () =>
    set((state) => {
      const visibleIds = new Set(get().visibleItems().map((item) => item.id));
      return {
        items: state.items.map((item) =>
          visibleIds.has(item.id) ? { ...item, selected: true } : item,
        ),
      };
    }),
  invertVisibleSelection: () =>
    set((state) => {
      const visibleIds = new Set(get().visibleItems().map((item) => item.id));
      return {
        items: state.items.map((item) =>
          visibleIds.has(item.id) ? { ...item, selected: !item.selected } : item,
        ),
      };
    }),
  selectUntaggedVisible: () =>
    set((state) => {
      const visibleIds = new Set(
        get()
          .visibleItems()
          .filter((item) => !item.tag)
          .map((item) => item.id),
      );
      return {
        items: state.items.map((item) => ({
          ...item,
          selected: visibleIds.has(item.id),
        })),
      };
    }),
  updateItemState: (id, nextState) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, state: nextState } : item,
      ),
    })),
  assignTagToSelected: (tagName) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.selected ? { ...item, tag: tagName } : item,
      ),
    })),
  visibleItems: () => {
    const { items, activeSourceId, search } = get();
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
  },
  selectedCount: () => get().items.filter((item) => item.selected).length,
  purgeCounts: () => {
    const items = get().items;
    return {
      keep: items.filter((item) => item.state === "keep").length,
      reject: items.filter((item) => item.state === "reject").length,
      maybe: items.filter((item) => item.state === "maybe").length,
    };
  },
}));
