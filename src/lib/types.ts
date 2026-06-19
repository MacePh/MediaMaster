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
  sourceName: string;
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
}

export interface MediaPage {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}
