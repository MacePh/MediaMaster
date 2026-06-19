use crate::db::Database;
use crate::models::{DbStatus, Source};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn add_source(_path: String, _db: State<'_, Mutex<Database>>) -> Result<Source, String> {
    Err("Source scanning is not implemented yet (Slice 2)".into())
}

#[tauri::command]
pub fn remove_source(_source_id: String, _db: State<'_, Mutex<Database>>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn list_sources(db: State<'_, Mutex<Database>>) -> Result<Vec<Source>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.name, s.path, s.color, s.live, COUNT(m.id) AS count
             FROM sources s
             LEFT JOIN media_items m ON m.source_id = s.id
             GROUP BY s.id
             ORDER BY s.created_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let sources = stmt
        .query_map([], |row| {
            Ok(Source {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                color: row.get(3)?,
                live: row.get::<_, i64>(4)? != 0,
                count: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(sources)
}

#[tauri::command]
pub fn scan_source(_source_id: String, _db: State<'_, Mutex<Database>>) -> Result<(), String> {
    Err("Scanning is not implemented yet (Slice 2)".into())
}

#[tauri::command]
pub fn get_db_status(db: State<'_, Mutex<Database>>) -> Result<DbStatus, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let migration_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    Ok(DbStatus {
        path: conn
            .path()
            .map(|path| path.to_string())
            .unwrap_or_else(|| "in-memory".into()),
        migration_count,
    })
}
