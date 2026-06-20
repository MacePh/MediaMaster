use crate::models::{Job, JobKind, JobStatus};
use crate::services::{ffprobe, holding};
use rusqlite::{params, Connection};
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgressEvent {
    pub job_id: String,
    pub progress: f64,
    pub status: JobStatus,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobDoneEvent {
    pub job_id: String,
    pub status: JobStatus,
    pub batch_id: Option<String>,
    pub error: Option<String>,
}

pub struct JobQueue {
    app: AppHandle,
    busy: Arc<Mutex<bool>>,
    cancel_job_id: Arc<Mutex<Option<String>>>,
}

impl JobQueue {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            busy: Arc::new(Mutex::new(false)),
            cancel_job_id: Arc::new(Mutex::new(None)),
        }
    }

    pub fn enqueue_holding_move(
        &self,
        conn: &Connection,
        item_ids: Vec<String>,
        label: String,
    ) -> Result<Job, String> {
        let job = insert_job(
            conn,
            JobKind::HoldingMove,
            format!("Move {} rejects to holding", item_ids.len()),
            item_ids,
            json!({ "label": label }),
            None,
        )?;
        self.kick(conn);
        Ok(job)
    }

    pub fn enqueue_holding_restore(
        &self,
        conn: &Connection,
        batch_id: String,
    ) -> Result<Job, String> {
        let job = insert_job(
            conn,
            JobKind::HoldingRestore,
            "Restore holding batch".into(),
            vec![batch_id.clone()],
            json!({ "batchId": batch_id }),
            None,
        )?;
        self.kick(conn);
        Ok(job)
    }

    pub fn enqueue_ffprobe_scan(
        &self,
        conn: &Connection,
        item_ids: Vec<String>,
    ) -> Result<Job, String> {
        let job = insert_job(
            conn,
            JobKind::FfprobeScan,
            format!("Probe metadata for {} videos", item_ids.len()),
            item_ids,
            json!({}),
            None,
        )?;
        self.kick(conn);
        Ok(job)
    }

    pub fn cancel(&self, conn: &Connection, job_id: &str) -> Result<(), String> {
        let status: String = conn
            .query_row(
                "SELECT status FROM jobs WHERE id = ?1",
                params![job_id],
                |row| row.get(0),
            )
            .map_err(|_| format!("Job not found: {job_id}"))?;

        if status == "running" {
            *self
                .cancel_job_id
                .lock()
                .map_err(|error| error.to_string())? = Some(job_id.to_string());
            return Ok(());
        }

        if status == "queued" {
            update_job_status(conn, job_id, JobStatus::Cancelled, 0.0, None, None)?;
            emit_done(&self.app, job_id, JobStatus::Cancelled, None, None);
        }

        Ok(())
    }

    fn kick(&self, conn: &Connection) {
        let db_path = match conn.path() {
            Some(path) => PathBuf::from(path),
            None => return,
        };

        let mut busy = match self.busy.lock() {
            Ok(value) => value,
            Err(_) => return,
        };

        if *busy {
            return;
        }

        *busy = true;
        drop(busy);

        let queue = JobQueue {
            app: self.app.clone(),
            busy: Arc::clone(&self.busy),
            cancel_job_id: Arc::clone(&self.cancel_job_id),
        };

        tauri::async_runtime::spawn(async move {
            let _ = tokio::task::spawn_blocking(move || queue.run_worker(db_path)).await;
        });
    }

    fn run_worker(&self, db_path: PathBuf) {
        loop {
            let next_job_id = {
                let conn = match Connection::open(&db_path) {
                    Ok(value) => value,
                    Err(_) => break,
                };
                let _ = conn.execute("PRAGMA foreign_keys = ON", []);
                match next_queued_job_id(&conn) {
                    Ok(Some(job_id)) => job_id,
                    _ => break,
                }
            };

            let conn = match Connection::open(&db_path) {
                Ok(value) => value,
                Err(_) => break,
            };
            let _ = conn.execute("PRAGMA foreign_keys = ON", []);

            if let Err(error) = self.run_job(&conn, &next_job_id) {
                let _ = update_job_status(
                    &conn,
                    &next_job_id,
                    JobStatus::Failed,
                    0.0,
                    None,
                    Some(&error),
                );
                emit_done(
                    &self.app,
                    &next_job_id,
                    JobStatus::Failed,
                    None,
                    Some(error),
                );
            }

            // If more queued jobs arrived while running, process them in this worker pass.
            if next_queued_job_id(&conn).ok().flatten().is_none() {
                break;
            }
        }

        if let Ok(mut busy) = self.busy.lock() {
            *busy = false;
        }
    }

    fn run_job(&self, conn: &Connection, job_id: &str) -> Result<(), String> {
        let job = load_job(conn, job_id)?;
        update_job_status(conn, job_id, JobStatus::Running, 0.0, None, None)?;
        emit_progress(&self.app, job_id, 0.0, JobStatus::Running);

        let cancelled = Arc::new(AtomicBool::new(false));
        let cancel_job_id = Arc::clone(&self.cancel_job_id);
        let job_id_string = job_id.to_string();

        let is_cancelled = || {
            if cancelled.load(Ordering::Relaxed) {
                return true;
            }
            if let Ok(guard) = cancel_job_id.lock() {
                if guard.as_deref() == Some(job_id_string.as_str()) {
                    cancelled.store(true, Ordering::Relaxed);
                    return true;
                }
            }
            false
        };

        let result = match job.kind {
            JobKind::HoldingMove => self.run_holding_move(conn, &job, &is_cancelled),
            JobKind::HoldingRestore => self.run_holding_restore(conn, &job, &is_cancelled),
            JobKind::FfprobeScan => self.run_ffprobe_scan(conn, &job, &is_cancelled),
            _ => Err(format!("Unsupported job kind: {:?}", job.kind)),
        };

        match result {
            Ok(batch_id) => {
                update_job_status(conn, job_id, JobStatus::Done, 100.0, batch_id.as_deref(), None)?;
                emit_progress(&self.app, job_id, 100.0, JobStatus::Done);
                emit_done(&self.app, job_id, JobStatus::Done, batch_id.clone(), None);
                if job.kind == JobKind::HoldingMove || job.kind == JobKind::HoldingRestore {
                    let _ = self.app.emit(
                        "holding:updated",
                        json!({ "batchId": batch_id }),
                    );
                }
            }
            Err(error) if is_cancelled() || error == "Job cancelled" => {
                update_job_status(conn, job_id, JobStatus::Cancelled, job.progress, None, None)?;
                emit_done(&self.app, job_id, JobStatus::Cancelled, None, None);
                if let Ok(mut guard) = self.cancel_job_id.lock() {
                    if guard.as_deref() == Some(job_id) {
                        *guard = None;
                    }
                }
            }
            Err(error) => {
                update_job_status(conn, job_id, JobStatus::Failed, job.progress, None, Some(&error))?;
                emit_done(&self.app, job_id, JobStatus::Failed, None, Some(error));
            }
        }

        Ok(())
    }

    fn run_holding_move(
        &self,
        conn: &Connection,
        job: &Job,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<Option<String>, String> {
        let label = job
            .params
            .get("label")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string();

        let batch = holding::move_to_holding_with_progress(
            conn,
            &job.inputs,
            &label,
            |progress| {
                let _ = update_job_status(conn, &job.id, JobStatus::Running, progress, None, None);
                emit_progress(&self.app, &job.id, progress, JobStatus::Running);
            },
            is_cancelled,
        )?;

        Ok(Some(batch.id))
    }

    fn run_holding_restore(
        &self,
        conn: &Connection,
        job: &Job,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<Option<String>, String> {
        let batch_id = job
            .params
            .get("batchId")
            .and_then(|value| value.as_str())
            .or_else(|| job.inputs.first().map(String::as_str))
            .ok_or_else(|| "Missing batch id".to_string())?;

        let batch = holding::restore_batch_with_progress(
            conn,
            batch_id,
            |progress| {
                let _ = update_job_status(conn, &job.id, JobStatus::Running, progress, None, None);
                emit_progress(&self.app, &job.id, progress, JobStatus::Running);
            },
            is_cancelled,
        )?;

        Ok(Some(batch.id))
    }

    fn run_ffprobe_scan(
        &self,
        conn: &Connection,
        job: &Job,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<Option<String>, String> {
        let ffprobe_path = ffprobe::resolve_ffprobe_path(conn)?;
        let total = job.inputs.len().max(1) as f64;

        for (index, media_id) in job.inputs.iter().enumerate() {
            if is_cancelled() {
                return Ok(None);
            }

            let (path, kind): (String, String) = conn
                .query_row(
                    "SELECT path, kind FROM media_items WHERE id = ?1",
                    params![media_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|_| format!("Media item not found: {media_id}"))?;

            if kind != "video" {
                continue;
            }

            let probe = ffprobe::probe_file(&ffprobe_path, Path::new(&path))?;
            conn.execute(
                "UPDATE media_items
                 SET codec = ?1, duration_sec = ?2, width = ?3, height = ?4,
                     bitrate = ?5, fps = ?6
                 WHERE id = ?7",
                params![
                    probe.codec,
                    probe.duration_sec,
                    probe.width,
                    probe.height,
                    probe.bitrate,
                    probe.fps,
                    media_id,
                ],
            )
            .map_err(|error| error.to_string())?;

            let progress = ((index + 1) as f64 / total) * 100.0;
            update_job_status(conn, &job.id, JobStatus::Running, progress, None, None)?;
            emit_progress(&self.app, &job.id, progress, JobStatus::Running);
        }

        Ok(None)
    }
}

pub fn list_jobs(conn: &Connection) -> Result<Vec<Job>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, kind, label, inputs_json, dest_path, params_json, status, progress,
                    command_text, error, undo_token, batch_id
             FROM jobs
             ORDER BY created_at DESC
             LIMIT 100",
        )
        .map_err(|error| error.to_string())?;

    let jobs = stmt
        .query_map([], row_to_job)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(jobs)
}

pub fn clear_finished_jobs(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "DELETE FROM jobs WHERE status IN ('done', 'failed', 'cancelled')",
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn insert_job(
    conn: &Connection,
    kind: JobKind,
    label: String,
    inputs: Vec<String>,
    params: serde_json::Value,
    batch_id: Option<String>,
) -> Result<Job, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let inputs_json = serde_json::to_string(&inputs).map_err(|error| error.to_string())?;
    let params_json = params.to_string();

    conn.execute(
        "INSERT INTO jobs (
            id, kind, label, inputs_json, dest_path, params_json, status, progress,
            command_text, error, undo_token, batch_id, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, NULL, ?5, 'queued', 0, NULL, NULL, NULL, ?6, ?7, ?7)",
        params![
            id,
            job_kind_to_str(&kind),
            label,
            inputs_json,
            params_json,
            batch_id,
            now,
        ],
    )
    .map_err(|error| error.to_string())?;

    load_job(conn, &id)
}

fn load_job(conn: &Connection, job_id: &str) -> Result<Job, String> {
    conn.query_row(
        "SELECT id, kind, label, inputs_json, dest_path, params_json, status, progress,
                command_text, error, undo_token, batch_id
         FROM jobs WHERE id = ?1",
        params![job_id],
        row_to_job,
    )
    .map_err(|error| error.to_string())
}

fn next_queued_job_id(conn: &Connection) -> Result<Option<String>, String> {
    match conn.query_row(
        "SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1",
        [],
        |row| row.get(0),
    ) {
        Ok(id) => Ok(Some(id)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn update_job_status(
    conn: &Connection,
    job_id: &str,
    status: JobStatus,
    progress: f64,
    batch_id: Option<&str>,
    error: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE jobs
         SET status = ?1, progress = ?2, batch_id = COALESCE(?3, batch_id), error = ?4, updated_at = ?5
         WHERE id = ?6",
        params![
            job_status_to_str(&status),
            progress,
            batch_id,
            error,
            now_unix(),
            job_id,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn row_to_job(row: &rusqlite::Row<'_>) -> rusqlite::Result<Job> {
    let inputs_json: String = row.get(3)?;
    let params_json: String = row.get(5)?;
    let kind: String = row.get(1)?;
    let status: String = row.get(6)?;

    Ok(Job {
        id: row.get(0)?,
        kind: parse_job_kind(&kind),
        label: row.get(2)?,
        inputs: serde_json::from_str(&inputs_json).unwrap_or_default(),
        dest_path: row.get(4)?,
        params: serde_json::from_str(&params_json).unwrap_or_else(|_| json!({})),
        status: parse_job_status(&status),
        progress: row.get(7)?,
        command: row.get(8)?,
        error: row.get(9)?,
        undo_token: row.get(10)?,
        batch_id: row.get(11)?,
    })
}

fn emit_progress(app: &AppHandle, job_id: &str, progress: f64, status: JobStatus) {
    let _ = app.emit(
        "job:progress",
        JobProgressEvent {
            job_id: job_id.to_string(),
            progress,
            status,
        },
    );
}

fn emit_done(
    app: &AppHandle,
    job_id: &str,
    status: JobStatus,
    batch_id: Option<String>,
    error: Option<String>,
) {
    let _ = app.emit(
        "job:done",
        JobDoneEvent {
            job_id: job_id.to_string(),
            status,
            batch_id,
            error,
        },
    );
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn job_kind_to_str(kind: &JobKind) -> &'static str {
    match kind {
        JobKind::HoldingMove => "holding_move",
        JobKind::HoldingRestore => "holding_restore",
        JobKind::FfprobeScan => "ffprobe_scan",
        JobKind::Transcode => "transcode",
        JobKind::Resize => "resize",
        JobKind::Proxy => "proxy",
        JobKind::ExtractFrames => "extract_frames",
        JobKind::ExtractAudio => "extract_audio",
        JobKind::ToWebp => "to_webp",
        JobKind::Move => "move",
        JobKind::Copy => "copy",
        JobKind::HoldingDelete => "holding_delete",
        JobKind::TagAssign => "tag_assign",
        JobKind::PurgeMark => "purge_mark",
    }
}

fn job_status_to_str(status: &JobStatus) -> &'static str {
    match status {
        JobStatus::Queued => "queued",
        JobStatus::Running => "running",
        JobStatus::Done => "done",
        JobStatus::Failed => "failed",
        JobStatus::Cancelled => "cancelled",
    }
}

fn parse_job_kind(value: &str) -> JobKind {
    match value {
        "holding_move" => JobKind::HoldingMove,
        "holding_restore" => JobKind::HoldingRestore,
        "ffprobe_scan" => JobKind::FfprobeScan,
        "transcode" => JobKind::Transcode,
        "resize" => JobKind::Resize,
        "proxy" => JobKind::Proxy,
        "extract_frames" => JobKind::ExtractFrames,
        "extract_audio" => JobKind::ExtractAudio,
        "to_webp" => JobKind::ToWebp,
        "move" => JobKind::Move,
        "copy" => JobKind::Copy,
        "holding_delete" => JobKind::HoldingDelete,
        "tag_assign" => JobKind::TagAssign,
        "purge_mark" => JobKind::PurgeMark,
        _ => JobKind::FfprobeScan,
    }
}

fn parse_job_status(value: &str) -> JobStatus {
    match value {
        "queued" => JobStatus::Queued,
        "running" => JobStatus::Running,
        "done" => JobStatus::Done,
        "failed" => JobStatus::Failed,
        "cancelled" => JobStatus::Cancelled,
        _ => JobStatus::Queued,
    }
}
