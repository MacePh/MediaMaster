import { create } from "zustand";
import type { MockMediaItem } from "../lib/types";

interface PurgeState {
  sessionItems: MockMediaItem[];
  index: number;
  undoStack: Array<{ itemId: string; previousState: MockMediaItem["state"] }>;
  started: boolean;
  startSession: (items: MockMediaItem[]) => void;
  currentItem: () => MockMediaItem | null;
  markCurrent: (state: MockMediaItem["state"]) => void;
  undo: () => void;
  remaining: () => number;
  sessionCounts: () => { keep: number; reject: number; maybe: number };
  reset: () => void;
}

export const usePurgeStore = create<PurgeState>((set, get) => ({
  sessionItems: [],
  index: 0,
  undoStack: [],
  started: false,
  startSession: (items) =>
    set({
      sessionItems: items.map((item) => ({ ...item, selected: false })),
      index: 0,
      undoStack: [],
      started: true,
    }),
  currentItem: () => {
    const { sessionItems, index } = get();
    return sessionItems[index] ?? null;
  },
  markCurrent: (nextState) => {
    const { sessionItems, index, undoStack } = get();
    const current = sessionItems[index];
    if (!current) {
      return;
    }

    const updated = sessionItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, state: nextState } : item,
    );

    set({
      sessionItems: updated,
      index: Math.min(index + 1, updated.length),
      undoStack: [
        ...undoStack,
        { itemId: current.id, previousState: current.state },
      ],
    });
  },
  undo: () => {
    const { sessionItems, undoStack } = get();
    const last = undoStack[undoStack.length - 1];
    if (!last) {
      return;
    }

    const targetIndex = sessionItems.findIndex((item) => item.id === last.itemId);
    const updated = sessionItems.map((item) =>
      item.id === last.itemId ? { ...item, state: last.previousState } : item,
    );

    set({
      sessionItems: updated,
      index: Math.max(0, targetIndex),
      undoStack: undoStack.slice(0, -1),
    });
  },
  remaining: () => {
    const { sessionItems, index } = get();
    return Math.max(0, sessionItems.length - index);
  },
  sessionCounts: () => {
    const { sessionItems } = get();
    return {
      keep: sessionItems.filter((item) => item.state === "keep").length,
      reject: sessionItems.filter((item) => item.state === "reject").length,
      maybe: sessionItems.filter((item) => item.state === "maybe").length,
    };
  },
  reset: () =>
    set({
      sessionItems: [],
      index: 0,
      undoStack: [],
      started: false,
    }),
}));
