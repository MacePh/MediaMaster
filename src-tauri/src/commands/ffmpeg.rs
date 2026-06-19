use crate::db::Database;
use crate::models::FfmpegInfo;
use crate::services::ffmpeg::{self, FfmpegOverrides};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn detect_ffmpeg(db: State<'_, Mutex<Database>>) -> Result<FfmpegInfo, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let ffmpeg_override: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'ffmpeg_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    let ffprobe_override: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'ffprobe_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    Ok(ffmpeg::detect(FfmpegOverrides {
        ffmpeg_path: ffmpeg_override,
        ffprobe_path: ffprobe_override,
    }))
}
