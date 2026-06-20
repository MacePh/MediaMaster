use crate::db::Database;
use crate::models::VlcInfo;
use crate::services::vlc::{self, VlcOverrides};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn detect_vlc(db: State<'_, Mutex<Database>>) -> Result<VlcInfo, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let vlc_override: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'vlc_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    let info = vlc::detect(VlcOverrides {
        vlc_path: vlc_override,
    });

    Ok(VlcInfo {
        vlc_path: info.vlc_path,
        vlc_version: info.vlc_version,
    })
}

#[tauri::command]
pub fn open_in_vlc(path: String, db: State<'_, Mutex<Database>>) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let vlc_override: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'vlc_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    let info = vlc::detect(VlcOverrides {
        vlc_path: vlc_override,
    });

    let vlc_path = info
        .vlc_path
        .ok_or_else(|| "VLC not detected".to_string())?;

    vlc::open_in_vlc(std::path::Path::new(&vlc_path), std::path::Path::new(&path))
}
