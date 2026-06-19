use crate::models::{MediaKind, ScanProgress};
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"];
const VIDEO_EXTS: &[&str] = &["mp4", "mov", "mkv", "avi", "webm", "m4v"];
const PROGRESS_INTERVAL: u64 = 50;
const HOLDING_DIR: &str = "_MediaMaster_Holding";

#[derive(Debug, Default, Clone, Copy)]
pub struct ScanStats {
    pub scanned: u64,
    pub added: u64,
    pub updated: u64,
    pub skipped: u64,
}

pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

pub fn media_id_for_path(path: &Path) -> String {
    let normalized = normalize_path(path);
    let digest = Sha256::digest(normalized.as_bytes());
    hex::encode(&digest[..16])
}

fn unix_timestamp_from(path: &Path) -> Option<i64> {
    let modified = path.metadata().ok()?.modified().ok()?;
    modified
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs() as i64)
}

fn kind_for_ext(ext: &str) -> Option<MediaKind> {
    let ext = ext.to_ascii_lowercase();
    if IMAGE_EXTS.contains(&ext.as_str()) {
        return Some(MediaKind::Image);
    }
    if VIDEO_EXTS.contains(&ext.as_str()) {
        return Some(MediaKind::Video);
    }
    None
}

fn should_skip_entry(entry: &walkdir::DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }

    entry.file_name() == HOLDING_DIR
}

pub fn scan_source<F>(
    conn: &Connection,
    source_id: &str,
    source_root: &Path,
    mut on_progress: F,
) -> Result<ScanStats, String>
where
    F: FnMut(ScanProgress),
{
    let mut stats = ScanStats::default();

    on_progress(ScanProgress {
        source_id: source_id.to_string(),
        scanned: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        phase: "scanning".to_string(),
        current_path: Some(source_root.display().to_string()),
        error: None,
    });

    for entry in WalkDir::new(source_root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !should_skip_entry(entry))
    {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        let Some(kind) = kind_for_ext(ext) else {
            continue;
        };

        stats.scanned += 1;
        let current_path = path.display().to_string();

        match upsert_media_item(conn, source_id, path, kind, ext) {
            Ok(UpsertAction::Added) => stats.added += 1,
            Ok(UpsertAction::Updated) => stats.updated += 1,
            Ok(UpsertAction::Skipped) => stats.skipped += 1,
            Err(error) => return Err(error),
        }

        if stats.scanned % PROGRESS_INTERVAL == 0 {
            on_progress(ScanProgress {
                source_id: source_id.to_string(),
                scanned: stats.scanned,
                added: stats.added,
                updated: stats.updated,
                skipped: stats.skipped,
                phase: "scanning".to_string(),
                current_path: Some(current_path),
                error: None,
            });
        }
    }

    on_progress(ScanProgress {
        source_id: source_id.to_string(),
        scanned: stats.scanned,
        added: stats.added,
        updated: stats.updated,
        skipped: stats.skipped,
        phase: "done".to_string(),
        current_path: None,
        error: None,
    });

    Ok(stats)
}

enum UpsertAction {
    Added,
    Updated,
    Skipped,
}

fn upsert_media_item(
    conn: &Connection,
    source_id: &str,
    path: &Path,
    kind: MediaKind,
    ext: &str,
) -> Result<UpsertAction, String> {
    let absolute_path = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf());
    let path_string = absolute_path.display().to_string();
    let modified_at = unix_timestamp_from(&absolute_path);
    let created_at = modified_at;
    let size_bytes = absolute_path
        .metadata()
        .map_err(|error| error.to_string())?
        .len() as i64;
    let name = absolute_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| path_string.clone());
    let id = media_id_for_path(&absolute_path);
    let kind_value = match kind {
        MediaKind::Image => "image",
        MediaKind::Video => "video",
    };
    let ext_value = ext.to_ascii_lowercase();

    let existing: Option<(String, Option<i64>)> = conn
        .query_row(
            "SELECT id, modified_at FROM media_items WHERE path = ?1",
            params![path_string],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    if let Some((existing_id, existing_modified)) = existing {
        if existing_modified == modified_at {
            return Ok(UpsertAction::Skipped);
        }

        conn.execute(
            "UPDATE media_items
             SET name = ?1, kind = ?2, ext = ?3, size_bytes = ?4,
                 created_at = ?5, modified_at = ?6, thumb_path = NULL
             WHERE id = ?7",
            params![
                name,
                kind_value,
                ext_value,
                size_bytes,
                created_at,
                modified_at,
                existing_id,
            ],
        )
        .map_err(|error| error.to_string())?;

        return Ok(UpsertAction::Updated);
    }

    conn.execute(
        "INSERT INTO media_items (
            id, source_id, path, name, kind, ext, size_bytes,
            created_at, modified_at, purge_state, favorite
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'unreviewed', 0)",
        params![
            id,
            source_id,
            path_string,
            name,
            kind_value,
            ext_value,
            size_bytes,
            created_at,
            modified_at,
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(UpsertAction::Added)
}

pub fn source_root_exists(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Invalid source path: {error}"))?;

    if !canonical.is_dir() {
        return Err("Source path must be a folder".into());
    }

    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_id_is_stable_for_same_path() {
        let path = PathBuf::from(r"C:\Photos\test.png");
        let first = media_id_for_path(&path);
        let second = media_id_for_path(&path);
        assert_eq!(first, second);
        assert_eq!(first.len(), 32);
    }

    #[test]
    fn classifies_extensions() {
        assert_eq!(kind_for_ext("jpg"), Some(MediaKind::Image));
        assert_eq!(kind_for_ext("MP4"), Some(MediaKind::Video));
        assert_eq!(kind_for_ext("txt"), None);
    }
}
