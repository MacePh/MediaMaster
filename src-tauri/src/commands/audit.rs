use crate::db::Database;
use crate::models::{AuditFinding, MediaFilter};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn run_media_audit(
    _filter: Option<MediaFilter>,
    _db: State<'_, Mutex<Database>>,
) -> Result<Vec<AuditFinding>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn list_audit_findings(_db: State<'_, Mutex<Database>>) -> Result<Vec<AuditFinding>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn dismiss_audit_finding(
    _id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    Ok(())
}
