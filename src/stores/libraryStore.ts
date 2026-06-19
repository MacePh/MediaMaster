import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import {
  buildSourceNameMap,
  mediaItemToCatalog,
  toSidebarSources,
} from "../lib/catalog";
import { addSource, listMedia, listSources, listTags, scanSource } from "../lib/tauri";
import type { MockMediaItem, MockSource, MockTag, ScanProgress } from "../lib/types";

interface LibraryState {
  items: MockMediaItem[];
  sources: MockSource[];
  rawSources: Array<{ id: string; name: string }>;
  tags: MockTag[];
  activeSourceId: string;
  search: string;
  loading: boolean;
  scanningSourceId: string | null;
  scanProgress: ScanProgress | null;
  setSearch: (search: string) => void;
  setActiveSource: (sourceId: string) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  loadCatalog: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  addSourceFromDialog: () => Promise<void>;
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
  items: [],
  sources: [{ id: "all", name: "All media", color: "#8a8f9b", count: 0 }],
  rawSources: [],
  tags: [],
  activeSourceId: "all",
  search: "",
  loading: false,
  scanningSourceId: null,
  scanProgress: null,
  setSearch: (search) => set({ search }),
  setActiveSource: (activeSourceId) => {
    set({ activeSourceId });
    void get().refreshMedia();
  },
  setScanProgress: (scanProgress) => set({ scanProgress }),
  loadCatalog: async () => {
    set({ loading: true });
    try {
      const [sources, tags] = await Promise.all([listSources(), listTags()]);
      set({
        sources: toSidebarSources(sources),
        rawSources: sources.map((source) => ({ id: source.id, name: source.name })),
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          hotkey: tag.hotkey ?? undefined,
          count: tag.count,
        })),
      });
      await get().refreshMedia();
    } finally {
      set({ loading: false });
    }
  },
  refreshMedia: async () => {
    const { activeSourceId, search } = get();
    const filter =
      activeSourceId === "all" && !search
        ? undefined
        : {
            sourceId: activeSourceId === "all" ? null : activeSourceId,
            search: search || null,
          };

    const page = await listMedia(filter, 1, 500);
    const sources = await listSources();
    const sourceNames = buildSourceNameMap(sources);
    const previousSelection = new Set(
      get().items.filter((item) => item.selected).map((item) => item.id),
    );

    set({
      sources: toSidebarSources(sources),
      rawSources: sources.map((source) => ({ id: source.id, name: source.name })),
      items: page.items.map((item) => {
        const catalogItem = mediaItemToCatalog(item, sourceNames);
        return {
          ...catalogItem,
          selected: previousSelection.has(item.id),
        };
      }),
    });
  },
  addSourceFromDialog: async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose source folder",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    set({ scanningSourceId: null, scanProgress: null });
    const source = await addSource(selected);
    set({ scanningSourceId: source.id });

    try {
      await scanSource(source.id);
      await get().loadCatalog();
    } finally {
      set({ scanningSourceId: null, scanProgress: null });
    }
  },
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
        activeSourceId === "all" || item.sourceId === activeSourceId;
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
