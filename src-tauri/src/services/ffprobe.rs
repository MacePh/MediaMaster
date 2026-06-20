use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Default)]
pub struct ProbeResult {
    pub codec: Option<String>,
    pub duration_sec: Option<f64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub bitrate: Option<i64>,
    pub fps: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    streams: Option<Vec<FfprobeStream>>,
    format: Option<FfprobeFormat>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
    avg_frame_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
    bit_rate: Option<String>,
}

pub fn probe_file(ffprobe_path: &Path, media_path: &Path) -> Result<ProbeResult, String> {
    let mut command = Command::new(ffprobe_path);
    command.args([
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        media_path.to_str().ok_or_else(|| "Invalid media path".to_string())?,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to run ffprobe: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed for {}: {stderr}", media_path.display()));
    }

    let parsed: FfprobeOutput = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to parse ffprobe output: {error}"))?;

    let video = parsed
        .streams
        .as_ref()
        .and_then(|streams| streams.iter().find(|stream| stream.codec_type.as_deref() == Some("video")));

    let duration_sec = parsed
        .format
        .as_ref()
        .and_then(|format| format.duration.as_ref())
        .and_then(|value| value.parse::<f64>().ok());

    let bitrate = parsed
        .format
        .as_ref()
        .and_then(|format| format.bit_rate.as_ref())
        .and_then(|value| value.parse::<i64>().ok());

    Ok(ProbeResult {
        codec: video.and_then(|stream| stream.codec_name.clone()),
        duration_sec,
        width: video.and_then(|stream| stream.width),
        height: video.and_then(|stream| stream.height),
        bitrate,
        fps: video.and_then(|stream| parse_frame_rate(stream.avg_frame_rate.as_deref()?)),
    })
}

fn parse_frame_rate(value: &str) -> Option<f64> {
    if let Some((num, den)) = value.split_once('/') {
        let numerator: f64 = num.parse().ok()?;
        let denominator: f64 = den.parse().ok()?;
        if denominator == 0.0 {
            return None;
        }
        return Some(numerator / denominator);
    }

    value.parse().ok()
}

pub fn resolve_ffprobe_path(conn: &rusqlite::Connection) -> Result<PathBuf, String> {
    let override_path: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'ffprobe_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    let info = crate::services::ffmpeg::detect(crate::services::ffmpeg::FfmpegOverrides {
        ffmpeg_path: None,
        ffprobe_path: override_path,
    });

    info
        .ffprobe_path
        .map(PathBuf::from)
        .ok_or_else(|| "FFprobe not detected".into())
}
