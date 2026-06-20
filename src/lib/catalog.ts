import { formatBytes, hashHue } from "./format";
import type { MediaItem, MockMediaItem, MockSource, Source } from "./types";

export function toSidebarSources(sources: Source[]): MockSource[] {
  const total = sources.reduce((sum, source) => sum + source.count, 0);

  return [
    { id: "all", name: "All media", color: "#8a8f9b", count: total },
    ...sources.map((source) => ({
      id: source.id,
      name: source.name,
      color: source.color,
      count: source.count,
    })),
  ];
}

export function mediaItemToCatalog(
  item: MediaItem,
  sourceNameById: Map<string, string>,
): MockMediaItem {
  const width = item.width ?? null;
  const height = item.height ?? null;

  return {
    id: item.id,
    name: item.name,
    ext: item.ext.toUpperCase(),
    kind: item.kind,
    dim: width && height ? `${width}×${height}` : "—",
    sizeLabel: formatBytes(item.sizeBytes),
    sizeBytes: item.sizeBytes,
    state: item.purgeState,
    tag: item.tags[0] ?? "",
    tags: item.tags,
    sourceId: item.sourceId,
    sourceName: sourceNameById.get(item.sourceId) ?? "Unknown source",
    filePath: item.path,
    thumbPath: item.thumbPath,
    selected: false,
    hue: hashHue(item.id),
  };
}

export function buildSourceNameMap(sources: Source[]): Map<string, string> {
  return new Map(sources.map((source) => [source.id, source.name]));
}
