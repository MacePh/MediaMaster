use crate::db::Database;
use crate::models::{HoldingBatch, HoldingPreview};
use crate::services::holding;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn preview_holding_move(
    item_ids: Vec<String>,
    db: State<'_, Mutex<Database>>,
) -> Result<HoldingPreview, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    holding::preview_move(db.conn(), &item_ids)
}

#[tauri::command]
pub fn move_to_holding(
    item_ids: Vec<String>,
    label: String,
    db: State<'_, Mutex<Database>>,
) -> Result<String, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let batch = holding::move_to_holding(db.conn(), &item_ids, &label)?;
    Ok(batch.id)
}

#[tauri::command]
pub fn list_holding_batches(
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<HoldingBatch>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, label, holding_path, status, created_at
             FROM safe_delete_batches
             ORDER BY created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let batches = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut result = Vec::new();
    for (id, label, holding_path, status, created_at) in batches {
        let mut item_stmt = conn
            .prepare("SELECT media_id, original_path, holding_path FROM safe_delete_items WHERE batch_id = ?1")
            .map_err(|error| error.to_string())?;

        let rows = item_stmt
            .query_map(rusqlite::params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        let mut item_ids = Vec::new();
        let mut original_to_holding = std::collections::HashMap::new();
        for (media_id, original, holding) in rows {
            item_ids.push(media_id);
            original_to_holding.insert(original, holding);
        }

        let batch_status = match status.as_str() {
            "restored" => crate::models::HoldingBatchStatus::Restored,
            "deleted" => crate::models::HoldingBatchStatus::Deleted,
            _ => crate::models::HoldingBatchStatus::Moved,
        };

        result.push(HoldingBatch {
            id,
            label,
            holding_path,
            item_ids,
            original_to_holding,
            created_at,
            status: batch_status,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn restore_holding_batch(
    batch_id: String,
    db: State<'_, Mutex<Database>>,
) -> Result<String, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let batch = holding::restore_batch(db.conn(), &batch_id)?;
    Ok(batch.id)
}

#[tauri::command]
pub fn final_delete_holding_batch(
    _batch_id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<String, String> {
    Err("Permanent delete is disabled in v1".into())
}
