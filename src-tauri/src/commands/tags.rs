use crate::db::Database;
use crate::models::Tag;
use rusqlite::params;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use uuid::Uuid;

const TAG_COLORS: &[&str] = &[
    "#4fd1c5", "#f2b84b", "#73a7ff", "#c77dff", "#7ddc83", "#e5705b",
];

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn fetch_tag(conn: &rusqlite::Connection, tag_id: &str) -> Result<Tag, String> {
    conn.query_row(
        "SELECT t.id, t.name, t.color, t.hotkey, t.created_at, COUNT(mt.media_id) AS count
         FROM tags t
         LEFT JOIN media_tags mt ON mt.tag_id = t.id
         WHERE t.id = ?1
         GROUP BY t.id",
        params![tag_id],
        |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                hotkey: row.get(3)?,
                created_at: row.get(4)?,
                count: row.get(5)?,
            })
        },
    )
    .map_err(|error| error.to_string())
}

fn pick_tag_color(conn: &rusqlite::Connection) -> Result<String, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    Ok(TAG_COLORS[count as usize % TAG_COLORS.len()].to_string())
}

#[tauri::command]
pub fn create_tag(
    name: String,
    color: Option<String>,
    hotkey: Option<String>,
    db: State<'_, Mutex<Database>>,
) -> Result<Tag, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Tag name is required".into());
    }

    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM tags WHERE lower(name) = lower(?1)",
            params![trimmed],
            |row| row.get(0),
        )
        .ok();

    if let Some(tag_id) = existing {
        return fetch_tag(conn, &tag_id);
    }

    let id = Uuid::new_v4().to_string();
    let tag_color = color.unwrap_or_else(|| pick_tag_color(conn).unwrap_or_else(|_| "#4fd1c5".into()));
    let created_at = now_unix();

    conn.execute(
        "INSERT INTO tags (id, name, color, hotkey, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, trimmed, tag_color, hotkey, created_at],
    )
    .map_err(|error| error.to_string())?;

    fetch_tag(conn, &id)
}

#[tauri::command]
pub fn rename_tag(
    _id: String,
    _name: String,
    _db: State<'_, Mutex<Database>>,
) -> Result<Tag, String> {
    Err("Tag rename is not implemented yet (Slice 5)".into())
}

#[tauri::command]
pub fn list_tags(db: State<'_, Mutex<Database>>) -> Result<Vec<Tag>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color, t.hotkey, t.created_at, COUNT(mt.media_id) AS count
             FROM tags t
             LEFT JOIN media_tags mt ON mt.tag_id = t.id
             GROUP BY t.id
             ORDER BY t.name ASC",
        )
        .map_err(|error| error.to_string())?;

    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                hotkey: row.get(3)?,
                created_at: row.get(4)?,
                count: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(tags)
}

#[tauri::command]
pub fn assign_tags(
    item_ids: Vec<String>,
    tag_ids: Vec<String>,
    db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    if item_ids.is_empty() || tag_ids.is_empty() {
        return Ok(());
    }

    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    for item_id in &item_ids {
        for tag_id in &tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?1, ?2)",
                params![item_id, tag_id],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn remove_tags(
    item_ids: Vec<String>,
    tag_ids: Vec<String>,
    db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    if item_ids.is_empty() || tag_ids.is_empty() {
        return Ok(());
    }

    let db = db.lock().map_err(|error| error.to_string())?;
    let conn = db.conn();

    for item_id in &item_ids {
        for tag_id in &tag_ids {
            conn.execute(
                "DELETE FROM media_tags WHERE media_id = ?1 AND tag_id = ?2",
                params![item_id, tag_id],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn set_tag_hotkey(
    _id: String,
    _hotkey: Option<String>,
    _db: State<'_, Mutex<Database>>,
) -> Result<Tag, String> {
    Err("Tag hotkey is not implemented yet (Slice 5)".into())
}
