use crate::db::Database;
use crate::models::{DbStatus, Source, SourceFolderNode};
use crate::services::folder_tree;
use crate::services::scanner::{scan_source as run_scan, source_root_exists};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

const SOURCE_COLORS: &[&str] = &[
    "#f2b84b", "#73a7ff", "#c77dff", "#7ddc83", "#e5705b", "#4fd1c5",
];

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn pick_source_color(conn: &Connection) -> Result<String, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sources", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    Ok(SOURCE_COLORS[count as usize % SOURCE_COLORS.len()].to_string())
}

fn fetch_source(conn: &Connection, source_id: &str) -> Result<Source, String> {
    conn.query_row(
        "SELECT s.id, s.name, s.path, s.color, s.live, COUNT(m.id) AS count
         FROM sources s
         LEFT JOIN media_items m ON m.source_id = s.id
         WHERE s.id = ?1
         GROUP BY s.id",
        params![source_id],
        |row| {
            Ok(Source {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                color: row.get(3)?,
                live: row.get::<_, i64>(4)? != 0,
                count: row.get(5)?,
            })
        },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn add_source(path: String, db: State<'_, Mutex<Database>>) -> Result<Source, String> {
    let canonical = source_root_exists(&path)?;
    let path_string = canonical.display().to_string();

    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM sources WHERE path = ?1",
            params![path_string],
            |row| row.get(0),
        )
        .ok();

    if let Some(source_id) = existing {
        return fetch_source(conn, &source_id);
    }

    let id = Uuid::new_v4().to_string();
    let name = canonical
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "Source".into());
    let color = pick_source_color(conn)?;
    let created_at = now_unix();

    conn.execute(
        "INSERT INTO sources (id, name, path, color, live, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, ?5)",
        params![id, name, path_string, color, created_at],
    )
    .map_err(|error| error.to_string())?;

    fetch_source(conn, &id)
}

#[tauri::command]
pub fn remove_source(source_id: String, db: State<'_, Mutex<Database>>) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    conn.execute(
        "DELETE FROM media_tags WHERE media_id IN (SELECT id FROM media_items WHERE source_id = ?1)",
        params![source_id],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM media_items WHERE source_id = ?1",
        params![source_id],
    )
    .map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM sources WHERE id = ?1", params![source_id])
        .map_err(|error| error.to_string())?;

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
pub async fn scan_source(
    source_id: String,
    app: AppHandle,
    db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    let (db_path, source_path) = {
        let db = db.lock().map_err(|error| error.to_string())?;
        let conn = db.conn();
        let db_path = PathBuf::from(
            conn.path()
                .ok_or_else(|| "Database path unavailable".to_string())?,
        );
        let source_path: String = conn
            .query_row(
                "SELECT path FROM sources WHERE id = ?1",
                params![source_id],
                |row| row.get(0),
            )
            .map_err(|_| "Source not found".to_string())?;
        (db_path, PathBuf::from(source_path))
    };

    let app_handle = app.clone();
    let source_id_for_task = source_id.clone();

    tokio::task::spawn_blocking(move || {
        let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|error| error.to_string())?;

        run_scan(&conn, &source_id_for_task, &source_path, |progress| {
            let _ = app_handle.emit("scan:progress", &progress);
        })
    })
    .await
    .map_err(|error| error.to_string())??;

    Ok(())
}

#[tauri::command]
pub fn list_source_folders(
    source_id: String,
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<SourceFolderNode>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    folder_tree::list_source_folder_tree(db.conn(), &source_id)
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
