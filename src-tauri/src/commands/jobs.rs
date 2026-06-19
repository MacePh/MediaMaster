use crate::db::Database;
use crate::models::Job;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_jobs(_db: State<'_, Mutex<Database>>) -> Result<Vec<Job>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn cancel_job(_id: String, _db: State<'_, Mutex<Database>>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn clear_finished_jobs(_db: State<'_, Mutex<Database>>) -> Result<(), String> {
    Ok(())
}
