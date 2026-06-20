use crate::models::SourceFolderNode;
use rusqlite::{Connection, params};
use std::collections::{HashMap, HashSet};

pub fn list_source_folder_tree(
    conn: &Connection,
    source_id: &str,
) -> Result<Vec<SourceFolderNode>, String> {
    let source_root: String = conn
        .query_row(
            "SELECT path FROM sources WHERE id = ?1",
            params![source_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let normalized_root = normalize_root(&source_root);

    let mut stmt = conn
        .prepare("SELECT path FROM media_items WHERE source_id = ?1")
        .map_err(|error| error.to_string())?;

    let paths = stmt
        .query_map(params![source_id], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut folder_counts: HashMap<String, i64> = HashMap::new();
    let mut folder_names: HashSet<String> = HashSet::new();

    for path in paths {
        let Some(rel_dir) = relative_dir(&normalized_root, &path) else {
            continue;
        };

        let mut prefixes = vec![rel_dir.clone()];
        let mut current = rel_dir;
        while let Some((parent, _)) = current.rsplit_once('/') {
            prefixes.push(parent.to_string());
            current = parent.to_string();
        }
        prefixes.push(String::new());

        for prefix in prefixes {
            *folder_counts.entry(prefix.clone()).or_insert(0) += 1;
            if !prefix.is_empty() {
                folder_names.insert(prefix);
            }
        }
    }

    Ok(build_children("", &folder_names, &folder_counts))
}

fn normalize_root(path: &str) -> String {
    path.trim_end_matches(['\\', '/']).replace('/', "\\")
}

fn relative_dir(source_root: &str, file_path: &str) -> Option<String> {
    let normalized_file = file_path.replace('/', "\\");
    let root_prefix = format!("{}\\", source_root);
    if !normalized_file.to_ascii_lowercase().starts_with(&root_prefix.to_ascii_lowercase()) {
        return None;
    }

    let remainder = &normalized_file[root_prefix.len()..];
    let parent = std::path::Path::new(remainder)
        .parent()
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default();

    Some(parent)
}

fn build_children(
    parent_rel: &str,
    folders: &HashSet<String>,
    counts: &HashMap<String, i64>,
) -> Vec<SourceFolderNode> {
    let mut children: Vec<SourceFolderNode> = folders
        .iter()
        .filter(|folder| is_immediate_child(parent_rel, folder))
        .map(|folder| {
            let name = folder
                .rsplit('/')
                .next()
                .unwrap_or(folder)
                .to_string();
            SourceFolderNode {
                rel_path: folder.clone(),
                name,
                count: counts.get(folder.as_str()).copied().unwrap_or(0),
                children: build_children(folder, folders, counts),
            }
        })
        .collect();

    children.sort_by(|left, right| left.name.to_ascii_lowercase().cmp(&right.name.to_ascii_lowercase()));
    children
}

fn is_immediate_child(parent_rel: &str, folder_rel: &str) -> bool {
    if parent_rel.is_empty() {
        return !folder_rel.contains('/');
    }

    let prefix = format!("{}/", parent_rel);
    if !folder_rel.starts_with(&prefix) {
        return false;
    }

    !folder_rel[prefix.len()..].contains('/')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_immediate_child_folders() {
        assert!(is_immediate_child("", "2024"));
        assert!(!is_immediate_child("", "2024/Jan"));
        assert!(is_immediate_child("2024", "2024/Jan"));
    }
}
