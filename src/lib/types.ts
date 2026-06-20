export type AppMode = "browse" | "purge" | "tagging" | "safe_delete" | "audit";

export type MediaKind = "image" | "video";

export type PurgeState = "unreviewed" | "keep" | "reject" | "maybe";

export type JobQueueStatus = "queued" | "running" | "done" | "failed" | "cancelled";

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
  codec?: string | null;
  durationSec?: number | null;
  bitrate?: number | null;
  fps?: number | null;
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

export type JobKind =
  | "holding_move"
  | "holding_restore"
  | "ffprobe_scan"
  | "transcode"
  | "resize"
  | "proxy"
  | "extract_frames"
  | "extract_audio"
  | "to_webp"
  | "move"
  | "copy"
  | "holding_delete"
  | "tag_assign"
  | "purge_mark";

export interface Job {
  id: string;
  kind: JobKind;
  label: string;
  inputs: string[];
  destPath?: string | null;
  params: Record<string, unknown>;
  status: JobQueueStatus;
  progress: number;
  command?: string | null;
  error?: string | null;
  undoToken?: string | null;
  batchId?: string | null;
}

export interface JobProgressEvent {
  jobId: string;
  progress: number;
  status: JobQueueStatus;
}

export interface JobDoneEvent {
  jobId: string;
  status: JobQueueStatus;
  batchId?: string | null;
  error?: string | null;
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

export interface VlcInfo {
  vlcPath?: string | null;
  vlcVersion?: string | null;
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
  itemIds?: string[] | null;
}

export type AuditFindingKind =
  | "large_video"
  | "large_image"
  | "not_hevc"
  | "duplicate_candidate"
  | "untagged_ai_render"
  | "rejects_pending"
  | "holding_pending"
  | "probe_failed";

export type AuditSeverity = "info" | "warning" | "action";

export type SuggestedAction =
  | "review_grid"
  | "purge"
  | "tag"
  | "compress"
  | "safe_delete"
  | "reveal";

export interface AuditFinding {
  id: string;
  kind: AuditFindingKind;
  label: string;
  detail: string;
  itemIds: string[];
  severity: AuditSeverity;
  suggestedAction: SuggestedAction;
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

export interface HoldingPreview {
  itemIds: string[];
  totalBytes: number;
  targetRoots: string[];
}

export type HoldingBatchStatus = "staged" | "moved" | "restored" | "deleted";

export interface HoldingBatch {
  id: string;
  label: string;
  holdingPath: string;
  itemIds: string[];
  originalToHolding: Record<string, string>;
  createdAt: number;
  status: HoldingBatchStatus;
}
