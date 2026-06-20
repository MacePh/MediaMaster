use image::imageops::FilterType;
use image::GenericImageView;
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use std::process::Command;

const MAX_EDGE: u32 = 256;

pub struct ThumbnailResult {
    pub media_id: String,
    pub thumb_path: String,
}

pub fn ensure_thumbnails(
    conn: &Connection,
    cache_dir: &Path,
    media_ids: &[String],
    ffmpeg_path: Option<&Path>,
) -> Result<Vec<ThumbnailResult>, String> {
    std::fs::create_dir_all(cache_dir).map_err(|error| error.to_string())?;

    let mut results = Vec::new();

    for media_id in media_ids {
        if let Some(result) = ensure_one(conn, cache_dir, media_id, ffmpeg_path)? {
            results.push(result);
        }
    }

    Ok(results)
}

fn ensure_one(
    conn: &Connection,
    cache_dir: &Path,
    media_id: &str,
    ffmpeg_path: Option<&Path>,
) -> Result<Option<ThumbnailResult>, String> {
    let (path, kind, modified_at, thumb_path): (String, String, Option<i64>, Option<String>) =
        conn.query_row(
            "SELECT path, kind, modified_at, thumb_path FROM media_items WHERE id = ?1",
            params![media_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|error| error.to_string())?;

    let expected_path = cache_path(cache_dir, media_id, modified_at);

    if thumb_path.as_deref() == Some(expected_path.to_str().unwrap_or_default())
        && expected_path.is_file()
    {
        return Ok(Some(ThumbnailResult {
            media_id: media_id.to_string(),
            thumb_path: expected_path.display().to_string(),
        }));
    }

    let source = PathBuf::from(&path);
    if !source.is_file() {
        return Ok(None);
    }

    let generated = match kind.as_str() {
        "video" => ffmpeg_path
            .and_then(|ffmpeg| generate_video_thumbnail(ffmpeg, &source, &expected_path).ok())
            .is_some(),
        _ => generate_image_thumbnail(&source, &expected_path).is_ok(),
    };

    if !generated {
        return Ok(None);
    }

    let (width, height) = image::open(&expected_path)
        .map(|image| {
            let (w, h) = image.dimensions();
            (Some(w as i64), Some(h as i64))
        })
        .unwrap_or((None, None));

    let thumb_path_string = expected_path.display().to_string();
    conn.execute(
        "UPDATE media_items SET thumb_path = ?1, width = COALESCE(?2, width), height = COALESCE(?3, height)
         WHERE id = ?4",
        params![thumb_path_string, width, height, media_id],
    )
    .map_err(|error| error.to_string())?;

    Ok(Some(ThumbnailResult {
        media_id: media_id.to_string(),
        thumb_path: thumb_path_string,
    }))
}

pub fn cache_path(cache_dir: &Path, media_id: &str, modified_at: Option<i64>) -> PathBuf {
    let stamp = modified_at.unwrap_or(0);
    cache_dir.join(format!("{media_id}_{stamp}.jpg"))
}

fn generate_image_thumbnail(source: &Path, dest: &Path) -> Result<(), String> {
    let image = image::open(source).map_err(|error| error.to_string())?;
    let (width, height) = image.dimensions();
    let thumb = if width.max(height) > MAX_EDGE {
        image.resize(MAX_EDGE, MAX_EDGE, FilterType::Triangle)
    } else {
        image
    };

    thumb
        .save_with_format(dest, image::ImageFormat::Jpeg)
        .map_err(|error| error.to_string())
}

fn generate_video_thumbnail(
    ffmpeg: &Path,
    source: &Path,
    dest: &Path,
) -> Result<(), String> {
    let status = Command::new(ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            "1",
            "-i",
        ])
        .arg(source)
        .args(["-frames:v", "1", "-q:v", "2", "-y"])
        .arg(dest)
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() && dest.is_file() {
        Ok(())
    } else {
        Err("FFmpeg thumbnail extraction failed".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_path_includes_modified_stamp() {
        let path = cache_path(Path::new("/cache"), "abc123", Some(42));
        assert!(path.to_string_lossy().contains("abc123_42.jpg"));
    }
}
