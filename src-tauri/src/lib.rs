mod commands;
mod db;
mod models;
mod services;

use commands::media::AppPaths;
use db::Database;
use services::job_runner::JobQueue;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");
            let db_path = app_data_dir.join("media_master.db");
            let database =
                Database::open(&db_path).expect("failed to open SQLite database");

            let thumb_cache_dir = app_data_dir.join("thumbs");
            std::fs::create_dir_all(&thumb_cache_dir).ok();

            app.manage(Mutex::new(database));
            app.manage(AppPaths { thumb_cache_dir });
            app.manage(Arc::new(JobQueue::new(app.handle().clone())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan::add_source,
            commands::scan::remove_source,
            commands::scan::list_sources,
            commands::scan::scan_source,
            commands::scan::list_source_folders,
            commands::scan::get_db_status,
            commands::media::list_media,
            commands::media::get_media_item,
            commands::media::update_media_state,
            commands::media::ensure_thumbnails,
            commands::tags::create_tag,
            commands::tags::rename_tag,
            commands::tags::list_tags,
            commands::tags::assign_tags,
            commands::tags::remove_tags,
            commands::tags::set_tag_hotkey,
            commands::purge::start_purge_session,
            commands::purge::mark_purge_decision,
            commands::purge::undo_purge_decision,
            commands::purge::finish_purge_session,
            commands::purge::list_rejects,
            commands::safe_delete::preview_holding_move,
            commands::safe_delete::move_to_holding,
            commands::safe_delete::list_holding_batches,
            commands::safe_delete::restore_holding_batch,
            commands::safe_delete::final_delete_holding_batch,
            commands::audit::run_media_audit,
            commands::audit::list_audit_findings,
            commands::audit::dismiss_audit_finding,
            commands::jobs::list_jobs,
            commands::jobs::cancel_job,
            commands::jobs::clear_finished_jobs,
            commands::jobs::enqueue_ffprobe_scan,
            commands::ffmpeg::detect_ffmpeg,
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::shell::copy_image_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
