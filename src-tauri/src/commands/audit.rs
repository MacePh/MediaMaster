use crate::db::Database;
use crate::models::{AuditFinding, MediaFilter};
use crate::services::audit;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn run_media_audit(
    filter: Option<MediaFilter>,
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<AuditFinding>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    audit::run_audit(db.conn(), filter.as_ref())
}

#[tauri::command]
pub fn list_audit_findings(
    filter: Option<MediaFilter>,
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<AuditFinding>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    audit::run_audit(db.conn(), filter.as_ref())
}

#[tauri::command]
pub fn dismiss_audit_finding(
    _id: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    Ok(())
}
