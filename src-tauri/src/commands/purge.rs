use crate::db::Database;
use crate::models::{MediaFilter, MediaItem, PurgeSession, PurgeState, PurgeSummary};
use std::sync::Mutex;
use tauri::State;

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

#[tauri::command]
pub fn list_rejects(
    _filter: Option<MediaFilter>,
    _db: State<'_, Mutex<Database>>,
) -> Result<Vec<MediaItem>, String> {
    Ok(Vec::new())
}
