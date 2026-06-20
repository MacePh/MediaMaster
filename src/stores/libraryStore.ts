import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import {
  mediaItemToCatalog,
  toSidebarSources,
} from "../lib/catalog";
import {
  addSource,
  assignTags,
  createTag,
  ensureThumbnails,
  listMedia,
  listSourceFolders,
  listSources,
  listTags,
  scanSource,
} from "../lib/tauri";
import type {
  MediaFilter,
  MockMediaItem,
  MockSource,
  MockTag,
  ScanProgress,
  SourceFolderNode,
} from "../lib/types";

const PAGE_SIZE = 100;
const THUMB_BATCH_SIZE = 24;
const PREFETCH_BUFFER_ITEMS = PAGE_SIZE * 2;

let searchRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let prefetchTimer: ReturnType<typeof setTimeout> | null = null;

function cancelBackgroundPrefetch(): void {
  if (prefetchTimer) {
    clearTimeout(prefetchTimer);
    prefetchTimer = null;
  }
}

function scheduleBackgroundPrefetch(
  getState: () => LibraryState,
  loadMoreMedia: () => Promise<void>,
): void {
  cancelBackgroundPrefetch();

  const tick = (): void => {
    const state = getState();
    if (!state.mediaHasMore || state.loadingMore || state.refreshingMedia) {
      prefetchTimer = window.setTimeout(tick, 400);
      return;
    }

    const targetCount = Math.min(state.mediaTotal, PREFETCH_BUFFER_ITEMS);
    if (state.items.length >= targetCount) {
      return;
    }

    void loadMoreMedia().finally(() => {
      prefetchTimer = window.setTimeout(tick, 350);
    });
  };

  prefetchTimer = window.setTimeout(tick, 250);
}

function sourceNameMap(rawSources: Array<{ id: string; name: string }>): Map<string, string> {
  return new Map(rawSources.map((source) => [source.id, source.name]));
}

interface LibraryState {
  items: MockMediaItem[];
  sources: MockSource[];
  rawSources: Array<{ id: string; name: string }>;
  tags: MockTag[];
  folderTrees: Record<string, SourceFolderNode[]>;
  expandedSources: Record<string, boolean>;
  expandedFolders: Record<string, boolean>;
  activeSourceId: string;
  activeFolderRelPath: string | null;
  activeTagId: string | null;
  search: string;
  mediaPage: number;
  mediaTotal: number;
  mediaHasMore: boolean;
  mediaRefreshGeneration: number;
  loading: boolean;
  loadingMore: boolean;
  refreshingMedia: boolean;
  scanningSourceId: string | null;
  scanProgress: ScanProgress | null;
  focusedItemId: string | null;
  selectMode: boolean;
  selectionAnchorId: string | null;
  setSearch: (search: string) => void;
  setActiveSource: (sourceId: string) => void;
  setActiveFolder: (sourceId: string, relPath: string) => void;
  setActiveTag: (tagId: string) => void;
  toggleSourceExpanded: (sourceId: string) => Promise<void>;
  toggleFolderExpanded: (key: string) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setFocusedItem: (itemId: string) => void;
  browseCheckboxSelect: (itemId: string, shiftKey: boolean) => void;
  browseToggleSelect: (itemId: string, shiftKey: boolean) => void;
  selectVisibleRange: (fromId: string, toId: string) => void;
  exitSelectMode: () => void;
  loadCatalog: () => Promise<void>;
  refreshTags: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  loadMoreMedia: () => Promise<void>;
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

function buildFilter(state: LibraryState): MediaFilter | undefined {
  const { activeSourceId, activeTagId, activeFolderRelPath, search } = state;
  const hasFilter =
    activeSourceId !== "all" ||
    Boolean(activeTagId) ||
    Boolean(activeFolderRelPath) ||
    Boolean(search.trim());

  if (!hasFilter) {
    return undefined;
  }

  return {
    sourceId: activeSourceId === "all" ? null : activeSourceId,
    tagId: activeTagId,
    folderRelPath: activeFolderRelPath,
    search: search.trim() || null,
  };
}

async function generateMissingThumbnails(
  items: MockMediaItem[],
  apply: (updates: Map<string, string>) => void,
) {
  const missing = items.filter((item) => !item.thumbPath).map((item) => item.id);
  if (missing.length === 0) {
    return;
  }

  // #region agent log
  fetch("http://127.0.0.1:7667/ingest/61655ba1-4c9d-4e22-abd4-4058870abec3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5832c" },
    body: JSON.stringify({
      sessionId: "c5832c",
      location: "libraryStore.ts:generateMissingThumbnails",
      message: "thumb batch start",
      data: { missingCount: missing.length, batchSize: THUMB_BATCH_SIZE },
      timestamp: Date.now(),
      hypothesisId: "H3-crash",
    }),
  }).catch(() => {});
  // #endregion

  for (let index = 0; index < missing.length; index += THUMB_BATCH_SIZE) {
    const batch = missing.slice(index, index + THUMB_BATCH_SIZE);
    const results = await ensureThumbnails(batch);
    if (results.length === 0) {
      continue;
    }

    apply(new Map(results.map((result) => [result.mediaId, result.thumbPath])));
  }
}

function mapPageItems(
  pageItems: Awaited<ReturnType<typeof listMedia>>["items"],
  sourceNames: Map<string, string>,
  previousSelection: Set<string>,
): MockMediaItem[] {
  return pageItems.map((item) => {
    const catalogItem = mediaItemToCatalog(item, sourceNames);
    return {
      ...catalogItem,
      selected: previousSelection.has(item.id),
    };
  });
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: [],
  sources: [{ id: "all", name: "All media", color: "#8a8f9b", count: 0 }],
  rawSources: [],
  tags: [],
  folderTrees: {},
  expandedSources: {},
  expandedFolders: {},
  activeSourceId: "all",
  activeFolderRelPath: null,
  activeTagId: null,
  search: "",
  mediaPage: 1,
  mediaTotal: 0,
  mediaHasMore: false,
  mediaRefreshGeneration: 0,
  loading: false,
  loadingMore: false,
  refreshingMedia: false,
  scanningSourceId: null,
  scanProgress: null,
  focusedItemId: null,
  selectMode: false,
  selectionAnchorId: null,
  setSearch: (search) => {
    set({ search, mediaPage: 1 });
    if (searchRefreshTimer) {
      clearTimeout(searchRefreshTimer);
    }
    searchRefreshTimer = setTimeout(() => {
      void get().refreshMedia();
    }, 300);
  },
  setActiveSource: (activeSourceId) => {
    cancelBackgroundPrefetch();
    set({
      activeSourceId,
      activeFolderRelPath: null,
      mediaPage: 1,
      items: [],
      mediaHasMore: false,
      refreshingMedia: true,
      mediaRefreshGeneration: get().mediaRefreshGeneration + 1,
    });
    void get().refreshMedia();
  },
  setActiveFolder: (sourceId, relPath) => {
    cancelBackgroundPrefetch();
    set({
      activeSourceId: sourceId,
      activeFolderRelPath: relPath,
      mediaPage: 1,
      items: [],
      mediaHasMore: false,
      refreshingMedia: true,
      mediaRefreshGeneration: get().mediaRefreshGeneration + 1,
    });
    // #region agent log
    fetch("http://127.0.0.1:7667/ingest/61655ba1-4c9d-4e22-abd4-4058870abec3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5832c" },
      body: JSON.stringify({
        sessionId: "c5832c",
        location: "libraryStore.ts:setActiveFolder",
        message: "folder filter set",
        data: { sourceId, relPath },
        timestamp: Date.now(),
        hypothesisId: "H2-folders",
      }),
    }).catch(() => {});
    // #endregion
    void get().refreshMedia();
  },
  setActiveTag: (tagId) => {
    const nextTagId = get().activeTagId === tagId ? null : tagId;
    cancelBackgroundPrefetch();
    set({
      activeTagId: nextTagId,
      mediaPage: 1,
      items: [],
      mediaHasMore: false,
      refreshingMedia: true,
      mediaRefreshGeneration: get().mediaRefreshGeneration + 1,
    });
    // #region agent log
    fetch("http://127.0.0.1:7667/ingest/61655ba1-4c9d-4e22-abd4-4058870abec3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5832c" },
      body: JSON.stringify({
        sessionId: "c5832c",
        location: "libraryStore.ts:setActiveTag",
        message: "tag filter toggled",
        data: { tagId, activeTagId: nextTagId },
        timestamp: Date.now(),
        hypothesisId: "H4-tags",
      }),
    }).catch(() => {});
    // #endregion
    void get().refreshMedia();
  },
  toggleSourceExpanded: async (sourceId) => {
    const isExpanded = get().expandedSources[sourceId] ?? false;
    if (isExpanded) {
      set((state) => ({
        expandedSources: { ...state.expandedSources, [sourceId]: false },
      }));
      return;
    }

    if (!get().folderTrees[sourceId]) {
      const tree = await listSourceFolders(sourceId);
      // #region agent log
      fetch("http://127.0.0.1:7667/ingest/61655ba1-4c9d-4e22-abd4-4058870abec3", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5832c" },
        body: JSON.stringify({
          sessionId: "c5832c",
          location: "libraryStore.ts:toggleSourceExpanded",
          message: "folder tree loaded",
          data: { sourceId, rootCount: tree.length },
          timestamp: Date.now(),
          hypothesisId: "H2-folders",
        }),
      }).catch(() => {});
      // #endregion
      set((state) => ({
        folderTrees: { ...state.folderTrees, [sourceId]: tree },
      }));
    }

    set((state) => ({
      expandedSources: { ...state.expandedSources, [sourceId]: true },
    }));
  },
  toggleFolderExpanded: (key) => {
    set((state) => ({
      expandedFolders: {
        ...state.expandedFolders,
        [key]: !(state.expandedFolders[key] ?? false),
      },
    }));
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
    const generation = get().mediaRefreshGeneration;
    const filter = buildFilter(get());

    set({ refreshingMedia: true });

    // #region agent log
    fetch("http://127.0.0.1:7667/ingest/61655ba1-4c9d-4e22-abd4-4058870abec3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5832c" },
      body: JSON.stringify({
        sessionId: "c5832c",
        location: "libraryStore.ts:refreshMedia",
        message: "list_media request",
        data: { filter, page: 1, pageSize: PAGE_SIZE, generation },
        timestamp: Date.now(),
        hypothesisId: "H3-crash,H4-tags",
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion

    try {
      const page = await listMedia(filter, 1, PAGE_SIZE);
      if (get().mediaRefreshGeneration !== generation) {
        return;
      }

      const names = sourceNameMap(get().rawSources);
      const previousSelection = new Set(
        get().items.filter((item) => item.selected).map((item) => item.id),
      );
      const previousFocus = get().focusedItemId;

      const items = mapPageItems(page.items, names, previousSelection);
      const mediaHasMore = items.length < page.total;

      const focusedItemId =
        previousFocus && items.some((item) => item.id === previousFocus)
          ? previousFocus
          : items[0]?.id ?? null;

      set({
        items,
        focusedItemId,
        mediaPage: 1,
        mediaTotal: page.total,
        mediaHasMore,
        refreshingMedia: false,
      });

      // #region agent log
      fetch("http://127.0.0.1:7667/ingest/61655ba1-4c9d-4e22-abd4-4058870abec3", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5832c" },
        body: JSON.stringify({
          sessionId: "c5832c",
          location: "libraryStore.ts:refreshMedia:done",
          message: "list_media response",
          data: {
            generation,
            itemCount: items.length,
            total: page.total,
            mediaHasMore,
          },
          timestamp: Date.now(),
          hypothesisId: "H3-load-more",
          runId: "post-fix",
        }),
      }).catch(() => {});
      // #endregion

      void generateMissingThumbnails(items, (updates) => {
        set((current) => ({
          items: current.items.map((item) =>
            updates.has(item.id) ? { ...item, thumbPath: updates.get(item.id) } : item,
          ),
        }));
      });

      scheduleBackgroundPrefetch(get, () => get().loadMoreMedia());
    } catch {
      if (get().mediaRefreshGeneration === generation) {
        set({ refreshingMedia: false });
      }
    }
  },
  loadMoreMedia: async () => {
    const state = get();
    if (state.loadingMore || !state.mediaHasMore || state.refreshingMedia) {
      return;
    }

    const generation = state.mediaRefreshGeneration;
    const nextPage = state.mediaPage + 1;
    set({ loadingMore: true });

    try {
      const filter = buildFilter(state);
      const page = await listMedia(filter, nextPage, PAGE_SIZE);
      if (get().mediaRefreshGeneration !== generation) {
        return;
      }

      const names = sourceNameMap(get().rawSources);
      const previousSelection = new Set(
        get().items.filter((item) => item.selected).map((item) => item.id),
      );

      const newItems = mapPageItems(page.items, names, previousSelection);

      set((current) => {
        const merged = [...current.items, ...newItems];
        return {
          items: merged,
          mediaPage: nextPage,
          mediaTotal: page.total,
          mediaHasMore: merged.length < page.total,
        };
      });

      void generateMissingThumbnails(newItems, (updates) => {
        set((current) => ({
          items: current.items.map((item) =>
            updates.has(item.id) ? { ...item, thumbPath: updates.get(item.id) } : item,
          ),
        }));
      });
    } finally {
      if (get().mediaRefreshGeneration === generation) {
        set({ loadingMore: false });
      }
    }
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
      const tree = await listSourceFolders(source.id);
      set((state) => ({
        folderTrees: { ...state.folderTrees, [source.id]: tree },
        expandedSources: { ...state.expandedSources, [source.id]: true },
      }));
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
  visibleItems: () => get().items,
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
