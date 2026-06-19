use crate::db::Database;
use crate::models::{HoldingBatch, HoldingPreview};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn preview_holding_move(
    _item_ids: Vec<String>,
    _db: State<'_, Mutex<Database>>,
) -> Result<HoldingPreview, String> {
    Ok(HoldingPreview {
        item_ids: Vec::new(),
        total_bytes: 0,
        target_roots: Vec::new(),
    })
}

#[tauri::command]
pub fn move_to_holding(
    _item_ids: Vec<String>,
    _label: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<String, String> {
    Err("Holding moves are not implemented yet (Slice 6)".into())
}

#[tauri::command]
pub fn list_holding_batches(
    _db: State<'_, Mutex<Database>>,
) -> Result<Vec<HoldingBatch>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn restore_holding_batch(
    _batch_id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<String, String> {
    Err("Holding restore is not implemented yet (Slice 6)".into())
}

#[tauri::command]
pub fn final_delete_holding_batch(
    _batch_id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<String, String> {
    Err("Permanent delete is disabled in v1".into())
}
