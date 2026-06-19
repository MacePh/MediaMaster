import { useMemo } from "react";
import { usePurgeStore } from "../stores/purgeStore";
import type { MockMediaItem } from "../lib/types";

export function usePurgeSessionCounts(): {
  keep: number;
  reject: number;
  maybe: number;
} {
  const sessionItems = usePurgeStore((state) => state.sessionItems);

  return useMemo(
    () => ({
      keep: sessionItems.filter((item) => item.state === "keep").length,
      reject: sessionItems.filter((item) => item.state === "reject").length,
      maybe: sessionItems.filter((item) => item.state === "maybe").length,
    }),
    [sessionItems],
  );
}

export function usePurgeCurrentItem(): MockMediaItem | null {
  const sessionItems = usePurgeStore((state) => state.sessionItems);
  const index = usePurgeStore((state) => state.index);

  return useMemo(() => sessionItems[index] ?? null, [sessionItems, index]);
}

export function usePurgeRemaining(): number {
  const sessionItems = usePurgeStore((state) => state.sessionItems);
  const index = usePurgeStore((state) => state.index);

  return useMemo(
    () => Math.max(0, sessionItems.length - index),
    [sessionItems, index],
  );
}
