use crate::db::Database;
use crate::models::{MediaFilter, MediaItem, PurgeSession, PurgeState, PurgeSummary};
use rusqlite::{params_from_iter, ToSql};
use std::sync::Mutex;
use tauri::State;

use super::media::{attach_tags, row_to_media_item};

const MEDIA_SELECT: &str = "SELECT id, path, name, kind, ext, size_bytes, width, height, duration_sec,
        codec, bitrate, fps, created_at, modified_at, source_id, thumb_path,
        purge_state, rating, favorite, holding_batch_id, original_path, last_reviewed_at
 FROM media_items";

#[tauri::command]
pub fn list_rejects(
    filter: Option<MediaFilter>,
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<MediaItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut where_clauses = vec![
        "purge_state = 'reject'".to_string(),
        "holding_batch_id IS NULL".to_string(),
    ];
    let mut values: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(filter) = filter {
        if let Some(ref source_id) = filter.source_id {
            where_clauses.push("source_id = ?".into());
            values.push(Box::new(source_id.clone()));
        }
    }

    let where_sql = format!(" WHERE {}", where_clauses.join(" AND "));
    let list_sql = format!("{MEDIA_SELECT}{where_sql} ORDER BY modified_at DESC, name ASC");

    let mut stmt = conn.prepare(&list_sql).map_err(|error| error.to_string())?;
    let mut items = stmt
        .query_map(
            params_from_iter(values.iter().map(|value| value.as_ref())),
            row_to_media_item,
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    attach_tags(conn, &mut items)?;

    Ok(items)
}

#[tauri::command]
pub fn start_purge_session(
    _item_ids: Vec<String>,
    _label: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<PurgeSession, String> {
    Err("Purge sessions are not implemented yet (Slice 4)".into())
}

#[tauri::command]
pub fn mark_purge_decision(
    _session_id: String,
    _item_id: String,
    _state: PurgeState,
    _db: State<'_, Mutex<Database>>,
) -> Result<PurgeSession, String> {
    Err("Purge sessions are not implemented yet (Slice 4)".into())
}

#[tauri::command]
pub fn undo_purge_decision(
    _session_id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<PurgeSession, String> {
    Err("Purge sessions are not implemented yet (Slice 4)".into())
}

#[tauri::command]
pub fn finish_purge_session(
    _session_id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<PurgeSummary, String> {
    Err("Purge sessions are not implemented yet (Slice 4)".into())
}
