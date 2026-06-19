use crate::db::Database;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn get_settings(db: State<'_, Mutex<Database>>) -> Result<HashMap<String, String>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut stmt = conn
        .prepare("SELECT key, value FROM app_settings ORDER BY key ASC")
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(rows.into_iter().collect())
}

#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.conn()
        .execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}
