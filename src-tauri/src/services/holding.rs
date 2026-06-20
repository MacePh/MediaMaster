use crate::models::{HoldingBatch, HoldingBatchStatus, HoldingPreview};
use rusqlite::{params, params_from_iter, Connection, ToSql};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub fn preview_move(conn: &Connection, item_ids: &[String]) -> Result<HoldingPreview, String> {
    if item_ids.is_empty() {
        return Ok(HoldingPreview {
            item_ids: Vec::new(),
            total_bytes: 0,
            target_roots: Vec::new(),
        });
    }

    let placeholders = placeholders(item_ids.len());
    let sql = format!(
        "SELECT id, path, size_bytes, source_id FROM media_items
         WHERE id IN ({placeholders})
           AND purge_state = 'reject'
           AND holding_batch_id IS NULL"
    );

    let mut stmt = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(
            params_from_iter(params_from_ids(item_ids).iter().map(|value| value.as_ref())),
            |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut total_bytes = 0_i64;
    let mut source_ids = HashSet::new();
    let mut valid_ids = Vec::new();

    for (id, _path, size, source_id) in rows {
        total_bytes += size;
        source_ids.insert(source_id);
        valid_ids.push(id);
    }

    let mut target_roots = Vec::new();
    for source_id in source_ids {
        let root: String = conn
            .query_row(
                "SELECT path FROM sources WHERE id = ?1",
                params![source_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        target_roots.push(format!(
            "{root}\\_MediaMaster_Holding\\",
            root = root.trim_end_matches(['\\', '/'])
        ));
    }

    target_roots.sort();

    Ok(HoldingPreview {
        item_ids: valid_ids,
        total_bytes,
        target_roots,
    })
}

pub fn move_to_holding(
    conn: &Connection,
    item_ids: &[String],
    label: &str,
) -> Result<HoldingBatch, String> {
    let preview = preview_move(conn, item_ids)?;
    if preview.item_ids.is_empty() {
        return Err("No eligible rejects to move".into());
    }

    let batch_id = Uuid::new_v4().to_string();
    let batch_label = if label.trim().is_empty() {
        timestamp_label()
    } else {
        label.trim().to_string()
    };
    let created_at = now_unix();

    let placeholders = placeholders(preview.item_ids.len());
    let sql = format!(
        "SELECT m.id, m.path, m.source_id, s.path AS source_root
         FROM media_items m
         JOIN sources s ON s.id = m.source_id
         WHERE m.id IN ({placeholders})
           AND m.purge_state = 'reject'
           AND m.holding_batch_id IS NULL"
    );

    let mut stmt = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(
            params_from_iter(params_from_ids(&preview.item_ids).iter().map(|value| value.as_ref())),
            |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut holding_paths = Vec::new();
    let mut original_to_holding = HashMap::new();
    let mut moved_ids = Vec::new();

    let tx = conn
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    for (media_id, original_path, _source_id, source_root) in rows {
        let root = source_root.trim_end_matches(['\\', '/']);
        let holding_root = PathBuf::from(format!("{root}\\_MediaMaster_Holding\\{batch_label}"));
        fs::create_dir_all(&holding_root).map_err(|error| error.to_string())?;

        let rel = relative_path_from_root(root, &original_path)?;
        let dest = unique_destination(&holding_root, &rel)?;

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        fs::rename(&original_path, &dest).map_err(|error| {
            format!("Failed to move {original_path} → {}: {error}", dest.display())
        })?;

        let holding_path = dest.to_string_lossy().to_string();
        holding_paths.push(holding_root.to_string_lossy().to_string());

        tx.execute(
            "INSERT INTO safe_delete_items (batch_id, media_id, original_path, holding_path)
             VALUES (?1, ?2, ?3, ?4)",
            params![batch_id, media_id, original_path, holding_path],
        )
        .map_err(|error| error.to_string())?;

        tx.execute(
            "UPDATE media_items
             SET path = ?1, original_path = ?2, holding_batch_id = ?3, thumb_path = NULL
             WHERE id = ?4",
            params![holding_path, original_path, batch_id, media_id],
        )
        .map_err(|error| error.to_string())?;

        original_to_holding.insert(original_path, holding_path);
        moved_ids.push(media_id);
    }

    let primary_holding_path = holding_paths
        .first()
        .cloned()
        .unwrap_or_else(|| batch_label.clone());

    tx.execute(
        "INSERT INTO safe_delete_batches (id, label, holding_path, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            batch_id,
            batch_label,
            primary_holding_path,
            "moved",
            created_at
        ],
    )
    .map_err(|error| error.to_string())?;

    tx.commit().map_err(|error| error.to_string())?;

    Ok(HoldingBatch {
        id: batch_id,
        label: batch_label,
        holding_path: primary_holding_path,
        item_ids: moved_ids,
        original_to_holding,
        created_at,
        status: HoldingBatchStatus::Moved,
    })
}

pub fn restore_batch(conn: &Connection, batch_id: &str) -> Result<HoldingBatch, String> {
    let (label, holding_path, status, created_at): (String, String, String, i64) = conn
        .query_row(
            "SELECT label, holding_path, status, created_at FROM safe_delete_batches WHERE id = ?1",
            params![batch_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| format!("Holding batch not found: {batch_id}"))?;

    if status == "restored" {
        return Err("This holding batch was already restored".into());
    }

    let mut item_stmt = conn
        .prepare(
            "SELECT media_id, original_path, holding_path FROM safe_delete_items WHERE batch_id = ?1",
        )
        .map_err(|error| error.to_string())?;

    let rows = item_stmt
        .query_map(params![batch_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if rows.is_empty() {
        return Err("Holding batch has no items".into());
    }

    let tx = conn
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    let mut item_ids = Vec::new();
    let mut original_to_holding = HashMap::new();

    for (media_id, original_path, holding_path) in rows {
        if !Path::new(&holding_path).exists() {
            return Err(format!("Missing holding file: {holding_path}"));
        }

        let original = PathBuf::from(&original_path);
        if let Some(parent) = original.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let dest = unique_file_path(&original)?;
        fs::rename(&holding_path, &dest).map_err(|error| {
            format!("Failed to restore {holding_path} → {}: {error}", dest.display())
        })?;

        let restored_path = dest.to_string_lossy().to_string();

        tx.execute(
            "UPDATE media_items
             SET path = ?1, original_path = NULL, holding_batch_id = NULL,
                 thumb_path = NULL, purge_state = 'reject'
             WHERE id = ?2",
            params![restored_path, media_id],
        )
        .map_err(|error| error.to_string())?;

        original_to_holding.insert(original_path, holding_path);
        item_ids.push(media_id);
    }

    tx.execute(
        "UPDATE safe_delete_batches SET status = 'restored' WHERE id = ?1",
        params![batch_id],
    )
    .map_err(|error| error.to_string())?;

    tx.commit().map_err(|error| error.to_string())?;

    Ok(HoldingBatch {
        id: batch_id.to_string(),
        label,
        holding_path,
        item_ids,
        original_to_holding,
        created_at,
        status: HoldingBatchStatus::Restored,
    })
}

fn unique_file_path(target: &Path) -> Result<PathBuf, String> {
    if !target.exists() {
        return Ok(target.to_path_buf());
    }

    let parent = target
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(PathBuf::new);
    let stem = target
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let ext = target
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();

    for suffix in 1..1000 {
        let candidate = parent.join(format!("{stem}_{suffix}{ext}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Could not find unique restore path for {}",
        target.display()
    ))
}

fn relative_path_from_root(source_root: &str, file_path: &str) -> Result<PathBuf, String> {
    let normalized_root = source_root.replace('/', "\\");
    let normalized_file = file_path.replace('/', "\\");
    let prefix = format!("{normalized_root}\\");

    if !normalized_file.to_ascii_lowercase().starts_with(&prefix.to_ascii_lowercase()) {
        return Err(format!("Path is outside source root: {file_path}"));
    }

    Ok(PathBuf::from(&normalized_file[prefix.len()..]))
}

fn unique_destination(holding_root: &Path, rel: &Path) -> Result<PathBuf, String> {
    let mut dest = holding_root.join(rel);
    if !dest.exists() {
        return Ok(dest);
    }

    let stem = rel
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let ext = rel
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();
    let parent = rel
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(PathBuf::new);

    for suffix in 1..1000 {
        let candidate_name = format!("{stem}_{suffix}{ext}");
        let candidate_rel = parent.join(candidate_name);
        dest = holding_root.join(&candidate_rel);
        if !dest.exists() {
            return Ok(dest);
        }
    }

    Err(format!("Could not find unique name for {}", rel.display()))
}

fn placeholders(count: usize) -> String {
    std::iter::repeat("?")
        .take(count)
        .collect::<Vec<_>>()
        .join(", ")
}

fn params_from_ids(ids: &[String]) -> Vec<Box<dyn ToSql>> {
    ids.iter().map(|id| Box::new(id.clone()) as Box<dyn ToSql>).collect()
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn timestamp_label() -> String {
    format!("batch-{}", now_unix())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_path_strips_source_root() {
        let rel = relative_path_from_root(
            "D:\\Photos",
            "D:\\Photos\\2024\\img.jpg",
        )
        .expect("relative path");
        assert_eq!(rel, PathBuf::from("2024\\img.jpg"));
    }
}
