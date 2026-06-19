use crate::db::Database;
use crate::models::Tag;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn create_tag(
    _name: String,
    _color: Option<String>,
    _hotkey: Option<String>,
    _db: State<'_, Mutex<Database>>,
) -> Result<Tag, String> {
    Err("Tag creation is not implemented yet (Slice 5)".into())
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
    _item_ids: Vec<String>,
    _tag_ids: Vec<String>,
    _db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn remove_tags(
    _item_ids: Vec<String>,
    _tag_ids: Vec<String>,
    _db: State<'_, Mutex<Database>>,
) -> Result<(), String> {
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
