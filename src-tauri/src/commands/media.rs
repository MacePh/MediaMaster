use crate::db::Database;
use crate::models::{MediaFilter, MediaItem, MediaKind, MediaPage, MediaPatch, PurgeState, ThumbnailResult};
use crate::services::ffmpeg::{self, FfmpegOverrides};
use crate::services::thumbnailer;
use rusqlite::{params, params_from_iter, ToSql};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppPaths {
    pub thumb_cache_dir: PathBuf,
}

fn parse_purge_state(value: &str) -> PurgeState {
    match value {
        "keep" => PurgeState::Keep,
        "reject" => PurgeState::Reject,
        "maybe" => PurgeState::Maybe,
        _ => PurgeState::Unreviewed,
    }
}

fn row_to_media_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<MediaItem> {
    let kind: String = row.get(3)?;
    let purge_state: String = row.get(16)?;

    Ok(MediaItem {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        kind: if kind == "video" {
            MediaKind::Video
        } else {
            MediaKind::Image
        },
        ext: row.get(4)?,
        size_bytes: row.get(5)?,
        width: row.get(6)?,
        height: row.get(7)?,
        duration_sec: row.get(8)?,
        codec: row.get(9)?,
        bitrate: row.get(10)?,
        fps: row.get(11)?,
        created_at: row.get(12)?,
        modified_at: row.get(13)?,
        source_id: row.get(14)?,
        thumb_path: row.get(15)?,
        tags: Vec::new(),
        collections: Vec::new(),
        rating: row.get(17)?,
        favorite: row.get::<_, i64>(18)? != 0,
        purge_state: parse_purge_state(&purge_state),
        holding_batch_id: row.get(19)?,
        original_path: row.get(20)?,
        last_reviewed_at: row.get(21)?,
    })
}

fn attach_tags(conn: &rusqlite::Connection, items: &mut [MediaItem]) -> Result<(), String> {
    if items.is_empty() {
        return Ok(());
    }

    let placeholders = std::iter::repeat("?")
        .take(items.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT mt.media_id, t.name
         FROM media_tags mt
         JOIN tags t ON t.id = mt.tag_id
         WHERE mt.media_id IN ({placeholders})
         ORDER BY t.name ASC"
    );

    let ids: Vec<&str> = items.iter().map(|item| item.id.as_str()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let mut tag_map: HashMap<String, Vec<String>> = HashMap::new();

    let rows = stmt
        .query_map(params_from_iter(ids.iter()), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;

    for row in rows {
        let (media_id, tag_name) = row.map_err(|error| error.to_string())?;
        tag_map.entry(media_id).or_default().push(tag_name);
    }

    for item in items {
        item.tags = tag_map.remove(&item.id).unwrap_or_default();
    }

    Ok(())
}

#[tauri::command]
pub fn list_media(
    filter: Option<MediaFilter>,
    page: Option<i64>,
    page_size: Option<i64>,
    db: State<'_, Mutex<Database>>,
) -> Result<MediaPage, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(200).clamp(1, 500);
    let offset = (page - 1) * page_size;

    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut where_clauses = Vec::<String>::new();
    let mut values: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(filter) = filter {
        if let Some(source_id) = filter.source_id {
            where_clauses.push("source_id = ?".into());
            values.push(Box::new(source_id));
        }
        if let Some(kind) = filter.kind {
            let kind_value = match kind {
                MediaKind::Image => "image",
                MediaKind::Video => "video",
            };
            where_clauses.push("kind = ?".into());
            values.push(Box::new(kind_value.to_string()));
        }
        if let Some(purge_state) = filter.purge_state {
            let state_value = match purge_state {
                PurgeState::Keep => "keep",
                PurgeState::Reject => "reject",
                PurgeState::Maybe => "maybe",
                PurgeState::Unreviewed => "unreviewed",
            };
            where_clauses.push("purge_state = ?".into());
            values.push(Box::new(state_value.to_string()));
        }
        if let Some(search) = filter.search {
            let trimmed = search.trim();
            if !trimmed.is_empty() {
                where_clauses.push("name LIKE ?".into());
                values.push(Box::new(format!("%{trimmed}%")));
            }
        }
        if let Some(tag_id) = filter.tag_id {
            where_clauses.push(
                "id IN (SELECT media_id FROM media_tags WHERE tag_id = ?)".into(),
            );
            values.push(Box::new(tag_id));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM media_items{where_sql}");
    let total: i64 = conn
        .query_row(
            &count_sql,
            params_from_iter(values.iter().map(|value| value.as_ref())),
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let list_sql = format!(
        "SELECT id, path, name, kind, ext, size_bytes, width, height, duration_sec,
                codec, bitrate, fps, created_at, modified_at, source_id, thumb_path,
                purge_state, rating, favorite, holding_batch_id, original_path, last_reviewed_at
         FROM media_items{where_sql}
         ORDER BY modified_at DESC, name ASC
         LIMIT ? OFFSET ?"
    );

    let mut list_values = values;
    list_values.push(Box::new(page_size));
    list_values.push(Box::new(offset));

    let mut stmt = conn.prepare(&list_sql).map_err(|error| error.to_string())?;
    let mut items = stmt
        .query_map(
            params_from_iter(list_values.iter().map(|value| value.as_ref())),
            row_to_media_item,
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    attach_tags(conn, &mut items)?;

    Ok(MediaPage {
        items,
        total,
        page,
        page_size,
    })
}

#[tauri::command]
pub fn ensure_thumbnails(
    item_ids: Vec<String>,
    db: State<'_, Mutex<Database>>,
    paths: State<'_, AppPaths>,
) -> Result<Vec<ThumbnailResult>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let ffmpeg_override: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'ffmpeg_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    let ffprobe_override: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'ffprobe_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    let ffmpeg_info = ffmpeg::detect(FfmpegOverrides {
        ffmpeg_path: ffmpeg_override,
        ffprobe_path: ffprobe_override,
    });

    let ffmpeg_path = ffmpeg_info
        .ffmpeg_path
        .as_ref()
        .map(PathBuf::from);

    let generated = thumbnailer::ensure_thumbnails(
        conn,
        &paths.thumb_cache_dir,
        &item_ids,
        ffmpeg_path.as_deref(),
    )?;

    Ok(generated
        .into_iter()
        .map(|result| ThumbnailResult {
            media_id: result.media_id,
            thumb_path: result.thumb_path,
        })
        .collect())
}

#[tauri::command]
pub fn get_media_item(id: String, db: State<'_, Mutex<Database>>) -> Result<MediaItem, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut item = conn
        .query_row(
            "SELECT id, path, name, kind, ext, size_bytes, width, height, duration_sec,
                codec, bitrate, fps, created_at, modified_at, source_id, thumb_path,
                purge_state, rating, favorite, holding_batch_id, original_path, last_reviewed_at
         FROM media_items WHERE id = ?1",
            params![id],
            row_to_media_item,
        )
        .map_err(|error| error.to_string())?;

    attach_tags(conn, std::slice::from_mut(&mut item))?;

    Ok(item)
}

#[tauri::command]
pub fn update_media_state(
    _id: String,
    _patch: MediaPatch,
    _db: State<'_, Mutex<Database>>,
) -> Result<MediaItem, String> {
    Err("Media updates are not implemented yet (Slice 4)".into())
}
