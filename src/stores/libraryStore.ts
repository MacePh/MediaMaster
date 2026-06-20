import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import {
  buildSourceNameMap,
  mediaItemToCatalog,
  toSidebarSources,
} from "../lib/catalog";
import {
  addSource,
  assignTags,
  createTag,
  ensureThumbnails,
  listMedia,
  listSources,
  listTags,
  scanSource,
} from "../lib/tauri";
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
  focusedItemId: string | null;
  selectMode: boolean;
  selectionAnchorId: string | null;
  setSearch: (search: string) => void;
  setActiveSource: (sourceId: string) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setFocusedItem: (itemId: string) => void;
  browseCheckboxSelect: (itemId: string, shiftKey: boolean) => void;
  browseToggleSelect: (itemId: string, shiftKey: boolean) => void;
  selectVisibleRange: (fromId: string, toId: string) => void;
  exitSelectMode: () => void;
  loadCatalog: () => Promise<void>;
  refreshTags: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  addSourceFromDialog: () => Promise<void>;
  createTagByName: (name: string) => Promise<MockTag>;
  assignTagToSelected: (tagId: string) => Promise<number>;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAllVisible: () => void;
  invertVisibleSelection: () => void;
  selectUntaggedVisible: () => void;
  updateItemState: (id: string, state: MockMediaItem["state"]) => void;
  visibleItems: () => MockMediaItem[];
  selectedCount: () => number;
  purgeCounts: () => { keep: number; reject: number; maybe: number };
}

async function generateMissingThumbnails(
  items: MockMediaItem[],
  apply: (updates: Map<string, string>) => void,
) {
  const missing = items.filter((item) => !item.thumbPath).map((item) => item.id);
  if (missing.length === 0) {
    return;
  }

  const batchSize = 60;
  for (let index = 0; index < missing.length; index += batchSize) {
    const batch = missing.slice(index, index + batchSize);
    const results = await ensureThumbnails(batch);
    if (results.length === 0) {
      continue;
    }

    apply(new Map(results.map((result) => [result.mediaId, result.thumbPath])));
  }
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
  focusedItemId: null,
  selectMode: false,
  selectionAnchorId: null,
  setSearch: (search) => set({ search }),
  setActiveSource: (activeSourceId) => {
    set({ activeSourceId });
    void get().refreshMedia();
  },
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setFocusedItem: (focusedItemId) => set({ focusedItemId }),
  browseCheckboxSelect: (itemId, shiftKey) => {
    const state = get();
    if (shiftKey && state.selectionAnchorId) {
      get().selectVisibleRange(state.selectionAnchorId, itemId);
      return;
    }

    const items = state.items.map((item) =>
      item.id === itemId ? { ...item, selected: !item.selected } : item,
    );
    const selectedCount = items.filter((item) => item.selected).length;

    set({
      items,
      selectMode: selectedCount > 0,
      selectionAnchorId: selectedCount > 0 ? itemId : null,
    });
  },
  browseToggleSelect: (itemId, shiftKey) => {
    const state = get();
    if (shiftKey && state.selectionAnchorId) {
      get().selectVisibleRange(state.selectionAnchorId, itemId);
      return;
    }

    const items = state.items.map((item) =>
      item.id === itemId ? { ...item, selected: !item.selected } : item,
    );
    const selectedCount = items.filter((item) => item.selected).length;

    set({
      items,
      selectMode: selectedCount > 0,
      selectionAnchorId: selectedCount > 0 ? itemId : null,
    });
  },
  selectVisibleRange: (fromId, toId) => {
    const visibleIds = get().visibleItems().map((item) => item.id);
    const fromIndex = visibleIds.indexOf(fromId);
    const toIndex = visibleIds.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = new Set(visibleIds.slice(start, end + 1));

    set((state) => ({
      items: state.items.map((item) => ({
        ...item,
        selected: rangeIds.has(item.id),
      })),
      selectMode: true,
      selectionAnchorId: fromId,
    }));
  },
  exitSelectMode: () =>
    set((state) => ({
      selectMode: false,
      selectionAnchorId: null,
      items: state.items.map((item) => ({ ...item, selected: false })),
    })),
  refreshTags: async () => {
    const tags = await listTags();
    set({
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        hotkey: tag.hotkey ?? undefined,
        count: tag.count,
      })),
    });
  },
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
    const previousFocus = get().focusedItemId;

    const items = page.items.map((item) => {
      const catalogItem = mediaItemToCatalog(item, sourceNames);
      return {
        ...catalogItem,
        selected: previousSelection.has(item.id),
      };
    });

    const focusedItemId =
      previousFocus && items.some((item) => item.id === previousFocus)
        ? previousFocus
        : items[0]?.id ?? null;

    set({
      sources: toSidebarSources(sources),
      rawSources: sources.map((source) => ({ id: source.id, name: source.name })),
      items,
      focusedItemId,
    });

    void generateMissingThumbnails(items, (updates) => {
      set((state) => ({
        items: state.items.map((item) =>
          updates.has(item.id) ? { ...item, thumbPath: updates.get(item.id) } : item,
        ),
      }));
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
  createTagByName: async (name) => {
    const tag = await createTag(name);
    const mapped = {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      hotkey: tag.hotkey ?? undefined,
      count: tag.count,
    };
    set((state) => ({
      tags: [...state.tags, mapped].sort((left, right) => left.name.localeCompare(right.name)),
    }));
    return mapped;
  },
  assignTagToSelected: async (tagId) => {
    const selectedIds = get()
      .items.filter((item) => item.selected)
      .map((item) => item.id);

    if (selectedIds.length === 0) {
      return 0;
    }

    await assignTags(selectedIds, [tagId]);
    await get().refreshTags();
    await get().refreshMedia();
    return selectedIds.length;
  },
  toggleSelection: (id) =>
    set((state) => {
      const items = state.items.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      );
      const selectedCount = items.filter((item) => item.selected).length;
      return {
        items,
        selectMode: state.selectMode || selectedCount > 0,
      };
    }),
  clearSelection: () =>
    set((state) => ({
      selectMode: false,
      selectionAnchorId: null,
      items: state.items.map((item) => ({ ...item, selected: false })),
    })),
  selectAllVisible: () =>
    set((state) => {
      const visible = get().visibleItems();
      const visibleIds = new Set(visible.map((item) => item.id));
      return {
        selectMode: visible.length > 0,
        selectionAnchorId: visible[0]?.id ?? null,
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
          .filter((item) => item.tags.length === 0)
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
  visibleItems: () => {
    const { items, activeSourceId, search } = get();
    return items.filter((item) => {
      const matchesSource =
        activeSourceId === "all" || item.sourceId === activeSourceId;
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
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
