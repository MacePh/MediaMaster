use crate::models::FfmpegInfo;

#[tauri::command]
pub fn detect_ffmpeg() -> Result<FfmpegInfo, String> {
    Ok(FfmpegInfo {
        ffmpeg_path: None,
        ffprobe_path: None,
        ffmpeg_version: None,
        ffprobe_version: None,
    })
}
