use crate::db::Database;
use crate::models::Job;
use crate::services::job_runner::{self, JobQueue};
use std::sync::{Arc, Mutex};
use tauri::State;

#[tauri::command]
pub fn list_jobs(db: State<'_, Mutex<Database>>) -> Result<Vec<Job>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    job_runner::list_jobs(db.conn())
}

#[tauri::command]
pub fn cancel_job(
    id: String,
    queue: State<'_, Arc<JobQueue>>,
    db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    queue.cancel(db.conn(), &id)
}

#[tauri::command]
pub fn clear_finished_jobs(db: State<'_, Mutex<Database>>) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    job_runner::clear_finished_jobs(db.conn())
}

#[tauri::command]
pub fn enqueue_ffprobe_scan(
    item_ids: Vec<String>,
    queue: State<'_, Arc<JobQueue>>,
    db: State<'_, Mutex<Database>>,
) -> Result<Job, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    queue.enqueue_ffprobe_scan(db.conn(), item_ids)
}
