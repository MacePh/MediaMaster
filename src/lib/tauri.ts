import { invoke } from "@tauri-apps/api/core";
import type {
  DbStatus,
  FfmpegInfo,
  MediaFilter,
  MediaItem,
  MediaPage,
  MediaPatch,
  Source,
  SourceFolderNode,
  Tag,
  ThumbnailResult,
} from "./types";

export async function getDbStatus(): Promise<DbStatus> {
  return invoke<DbStatus>("get_db_status");
}

export async function listSources(): Promise<Source[]> {
  return invoke<Source[]>("list_sources");
}

export async function addSource(path: string): Promise<Source> {
  return invoke<Source>("add_source", { path });
}

export async function removeSource(sourceId: string): Promise<void> {
  return invoke("remove_source", { sourceId });
}

export async function scanSource(sourceId: string): Promise<void> {
  return invoke("scan_source", { sourceId });
}

export async function listMedia(
  filter?: MediaFilter,
  page?: number,
  pageSize?: number,
): Promise<MediaPage> {
  return invoke<MediaPage>("list_media", { filter, page, pageSize });
}

export async function updateMediaState(id: string, patch: MediaPatch): Promise<MediaItem> {
  return invoke<MediaItem>("update_media_state", { id, patch });
}

export async function listSourceFolders(sourceId: string): Promise<SourceFolderNode[]> {
  return invoke<SourceFolderNode[]>("list_source_folders", { sourceId });
}

export async function listTags(): Promise<Tag[]> {
  return invoke<Tag[]>("list_tags");
}

export async function createTag(
  name: string,
  color?: string | null,
  hotkey?: string | null,
): Promise<Tag> {
  return invoke<Tag>("create_tag", { name, color, hotkey });
}

export async function assignTags(itemIds: string[], tagIds: string[]): Promise<void> {
  return invoke("assign_tags", { itemIds, tagIds });
}

export async function ensureThumbnails(itemIds: string[]): Promise<ThumbnailResult[]> {
  return invoke<ThumbnailResult[]>("ensure_thumbnails", { itemIds });
}

export async function copyImageToClipboard(path: string): Promise<void> {
  return invoke("copy_image_to_clipboard", { path });
}

export async function detectFfmpeg(): Promise<FfmpegInfo> {
  return invoke<FfmpegInfo>("detect_ffmpeg");
}

export async function getSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_settings");
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export async function listRejects(filter?: MediaFilter): Promise<unknown[]> {
  return invoke<unknown[]>("list_rejects", { filter });
}

export async function listJobs(): Promise<unknown[]> {
  return invoke<unknown[]>("list_jobs");
}

export async function runMediaAudit(filter?: MediaFilter): Promise<unknown[]> {
  return invoke<unknown[]>("run_media_audit", { filter });
}

export async function listHoldingBatches(): Promise<unknown[]> {
  return invoke<unknown[]>("list_holding_batches");
}

export async function moveToHolding(
  itemIds: string[],
  label: string,
): Promise<string> {
  return invoke<string>("move_to_holding", { itemIds, label });
}

export async function finalDeleteHoldingBatch(batchId: string): Promise<string> {
  return invoke<string>("final_delete_holding_batch", { batchId });
}
