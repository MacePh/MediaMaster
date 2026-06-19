use crate::models::FfmpegInfo;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct FfmpegOverrides {
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
}

pub fn detect(overrides: FfmpegOverrides) -> FfmpegInfo {
    let ffmpeg_path = overrides
        .ffmpeg_path
        .and_then(|path| validate_binary(Path::new(&path)))
        .or_else(|| find_binary("ffmpeg"));

    let ffprobe_path = overrides
        .ffprobe_path
        .and_then(|path| validate_binary(Path::new(&path)))
        .or_else(|| find_binary("ffprobe"))
        .or_else(|| ffmpeg_path.as_ref().and_then(|ffmpeg| sibling_ffprobe(ffmpeg)));

    FfmpegInfo {
        ffmpeg_path: ffmpeg_path.as_ref().map(|path| path.display().to_string()),
        ffprobe_path: ffprobe_path.as_ref().map(|path| path.display().to_string()),
        ffmpeg_version: ffmpeg_path.as_ref().and_then(|path| read_version(path)),
        ffprobe_version: ffprobe_path.as_ref().and_then(|path| read_version(path)),
    }
}

fn validate_binary(path: &Path) -> Option<PathBuf> {
    if path.is_file() {
        Some(path.to_path_buf())
    } else {
        None
    }
}

fn find_binary(name: &str) -> Option<PathBuf> {
    if let Some(path) = find_on_path(name) {
        return Some(path);
    }

    for candidate in common_windows_candidates(name) {
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    let executable = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };

    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            let candidate = dir.join(&executable);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    if cfg!(windows) {
        let output = Command::new("where").arg(name).output().ok()?;
        if !output.status.success() {
            return None;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                let path = PathBuf::from(trimmed);
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    } else {
        let output = Command::new("which").arg(name).output().ok()?;
        if !output.status.success() {
            return None;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let trimmed = stdout.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.is_file() {
                return Some(path);
            }
        }
    }

    None
}

fn common_windows_candidates(name: &str) -> Vec<PathBuf> {
    if !cfg!(windows) {
        return Vec::new();
    }

    let file_name = format!("{name}.exe");
    vec![
        PathBuf::from(r"C:\ffmpeg_latest").join(&file_name),
        PathBuf::from(r"C:\ffmpeg\bin").join(&file_name),
        PathBuf::from(r"C:\ffmpeg").join(&file_name),
        PathBuf::from(r"C:\Program Files\ffmpeg\bin").join(&file_name),
        PathBuf::from(r"C:\Program Files (x86)\ffmpeg\bin").join(&file_name),
    ]
}

fn sibling_ffprobe(ffmpeg_path: &Path) -> Option<PathBuf> {
    let parent = ffmpeg_path.parent()?;
    let ffprobe = parent.join(if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    });

    if ffprobe.is_file() {
        Some(ffprobe)
    } else {
        None
    }
}

fn read_version(path: &Path) -> Option<String> {
    let mut command = Command::new(path);
    command.arg("-version");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_ffmpeg_when_available() {
        let info = detect(FfmpegOverrides {
            ffmpeg_path: None,
            ffprobe_path: None,
        });

        if find_binary("ffmpeg").is_some() {
            assert!(info.ffmpeg_path.is_some());
            assert!(info.ffmpeg_version.is_some());
        }
    }
}
