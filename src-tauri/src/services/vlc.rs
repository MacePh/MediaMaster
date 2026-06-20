use std::path::{Path, PathBuf};
use std::process::Command;

pub struct VlcOverrides {
    pub vlc_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct VlcInfo {
    pub vlc_path: Option<String>,
    pub vlc_version: Option<String>,
}

pub fn detect(overrides: VlcOverrides) -> VlcInfo {
    let vlc_path = overrides
        .vlc_path
        .and_then(|path| validate_binary(Path::new(&path)))
        .or_else(find_vlc);

    VlcInfo {
        vlc_path: vlc_path.as_ref().map(|path| path.display().to_string()),
        vlc_version: vlc_path.as_ref().and_then(|path| read_version(path)),
    }
}

pub fn open_in_vlc(vlc_path: &Path, media_path: &Path) -> Result<(), String> {
    if !media_path.is_file() {
        return Err(format!("File not found: {}", media_path.display()));
    }

    let mut command = Command::new(vlc_path);
    command.args([
        "--one-instance",
        "--play-and-exit",
        media_path.to_str().ok_or_else(|| "Invalid media path".to_string())?,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map_err(|error| format!("Failed to launch VLC: {error}"))?;

    Ok(())
}

fn validate_binary(path: &Path) -> Option<PathBuf> {
    if path.is_file() {
        Some(path.to_path_buf())
    } else {
        None
    }
}

fn find_vlc() -> Option<PathBuf> {
    if let Some(path) = find_on_path("vlc") {
        return Some(path);
    }

    for candidate in common_windows_candidates() {
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
    }

    None
}

fn common_windows_candidates() -> Vec<PathBuf> {
    if !cfg!(windows) {
        return Vec::new();
    }

    vec![
        PathBuf::from(r"C:\Program Files\VideoLAN\VLC\vlc.exe"),
        PathBuf::from(r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"),
    ]
}

fn read_version(path: &Path) -> Option<String> {
    let mut command = Command::new(path);
    command.arg("--version");

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
