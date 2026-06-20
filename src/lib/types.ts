export type AppMode = "browse" | "purge" | "tagging" | "safe_delete" | "audit";

export type MediaKind = "image" | "video";

export type PurgeState = "unreviewed" | "keep" | "reject" | "maybe";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface MockMediaItem {
  id: string;
  name: string;
  ext: string;
  kind: MediaKind;
  dim: string;
  sizeLabel: string;
  sizeBytes: number;
  state: PurgeState;
  tag: string;
  tags: string[];
  sourceId: string;
  sourceName: string;
  filePath: string;
  thumbPath?: string | null;
  selected: boolean;
  hue: number;
}

export interface MockTag {
  id: string;
  name: string;
  color: string;
  hotkey?: string;
  count: number;
}

export interface MockSource {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface MockJob {
  id: string;
  name: string;
  op: string;
  pct: number;
  done: boolean;
}

export interface DbStatus {
  path: string;
  migrationCount: number;
}

export interface FfmpegInfo {
  ffmpegPath?: string | null;
  ffprobePath?: string | null;
  ffmpegVersion?: string | null;
  ffprobeVersion?: string | null;
}

export interface Source {
  id: string;
  name: string;
  path: string;
  color: string;
  live: boolean;
  count: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  hotkey?: string | null;
  count: number;
  createdAt: number;
}

export interface MediaFilter {
  sourceId?: string | null;
  kind?: MediaKind | null;
  purgeState?: PurgeState | null;
  tagId?: string | null;
  search?: string | null;
  folderRelPath?: string | null;
}

export interface MediaPatch {
  purgeState?: PurgeState | null;
  favorite?: boolean | null;
  rating?: number | null;
}

export interface SourceFolderNode {
  relPath: string;
  name: string;
  count: number;
  children: SourceFolderNode[];
}

export interface MediaItem {
  id: string;
  path: string;
  name: string;
  kind: MediaKind;
  ext: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  fps?: number | null;
  createdAt?: number | null;
  modifiedAt?: number | null;
  sourceId: string;
  thumbPath?: string | null;
  tags: string[];
  collections: string[];
  rating?: number | null;
  favorite: boolean;
  purgeState: PurgeState;
  holdingBatchId?: string | null;
  originalPath?: string | null;
  lastReviewedAt?: number | null;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ScanProgress {
  sourceId: string;
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  phase: "scanning" | "done" | "error";
  currentPath?: string | null;
  error?: string | null;
}

export interface ThumbnailResult {
  mediaId: string;
  thumbPath: string;
}
