use crate::db::Database;
use crate::models::{MediaFilter, MediaItem, MediaPage, MediaPatch};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_media(
    _filter: Option<MediaFilter>,
    _page: Option<i64>,
    _page_size: Option<i64>,
    _db: State<'_, Mutex<Database>>,
) -> Result<MediaPage, String> {
    Ok(MediaPage {
        items: Vec::new(),
        total: 0,
        page: _page.unwrap_or(1),
        page_size: _page_size.unwrap_or(200),
    })
}

#[tauri::command]
pub fn get_media_item(_id: String, _db: State<'_, Mutex<Database>>) -> Result<MediaItem, String> {
    Err("Media item not found".into())
}

#[tauri::command]
pub fn update_media_state(
    _id: String,
    _patch: MediaPatch,
    _db: State<'_, Mutex<Database>>,
) -> Result<MediaItem, String> {
    Err("Media item not found".into())
}
