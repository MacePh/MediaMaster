use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Image,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PurgeState {
    Unreviewed,
    Keep,
    Reject,
    Maybe,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobKind {
    Transcode,
    Resize,
    Proxy,
    ExtractFrames,
    ExtractAudio,
    ToWebp,
    Move,
    Copy,
    HoldingMove,
    HoldingRestore,
    HoldingDelete,
    TagAssign,
    PurgeMark,
    FfprobeScan,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Queued,
    Running,
    Done,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HoldingBatchStatus {
    Staged,
    Moved,
    Restored,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditFindingKind {
    LargeVideo,
    LargeImage,
    NotHevc,
    DuplicateCandidate,
    UntaggedAiRender,
    RejectsPending,
    HoldingPending,
    ProbeFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuditSeverity {
    Info,
    Warning,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SuggestedAction {
    ReviewGrid,
    Purge,
    Tag,
    Compress,
    SafeDelete,
    Reveal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: String,
    pub name: String,
    pub path: String,
    pub color: String,
    pub live: bool,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub kind: MediaKind,
    pub ext: String,
    pub size_bytes: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_sec: Option<f64>,
    pub codec: Option<String>,
    pub bitrate: Option<i64>,
    pub fps: Option<f64>,
    pub created_at: Option<i64>,
    pub modified_at: Option<i64>,
    pub source_id: String,
    pub thumb_path: Option<String>,
    pub tags: Vec<String>,
    pub collections: Vec<String>,
    pub rating: Option<i64>,
    pub favorite: bool,
    pub purge_state: PurgeState,
    pub holding_batch_id: Option<String>,
    pub original_path: Option<String>,
    pub last_reviewed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub hotkey: Option<String>,
    pub count: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeSession {
    pub id: String,
    pub source_filter_label: String,
    pub item_ids: Vec<String>,
    pub index: usize,
    pub decisions: std::collections::HashMap<String, PurgeState>,
    pub undo_stack: Vec<PurgeUndoEntry>,
    pub started_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeUndoEntry {
    pub item_id: String,
    pub from: PurgeState,
    pub to: PurgeState,
    pub at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeSummary {
    pub session_id: String,
    pub keep_count: i64,
    pub reject_count: i64,
    pub maybe_count: i64,
    pub rejected_item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HoldingBatch {
    pub id: String,
    pub label: String,
    pub holding_path: String,
    pub item_ids: Vec<String>,
    pub original_to_holding: std::collections::HashMap<String, String>,
    pub created_at: i64,
    pub status: HoldingBatchStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HoldingPreview {
    pub item_ids: Vec<String>,
    pub total_bytes: i64,
    pub target_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditFinding {
    pub id: String,
    pub kind: AuditFindingKind,
    pub label: String,
    pub detail: String,
    pub item_ids: Vec<String>,
    pub severity: AuditSeverity,
    pub suggested_action: SuggestedAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub kind: JobKind,
    pub label: String,
    pub inputs: Vec<String>,
    pub dest_path: Option<String>,
    pub params: serde_json::Value,
    pub status: JobStatus,
    pub progress: f64,
    pub command: Option<String>,
    pub error: Option<String>,
    pub undo_token: Option<String>,
    pub batch_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegInfo {
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub ffprobe_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFilter {
    pub source_id: Option<String>,
    pub kind: Option<MediaKind>,
    pub purge_state: Option<PurgeState>,
    pub tag_id: Option<String>,
    pub search: Option<String>,
    pub folder_rel_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPage {
    pub items: Vec<MediaItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPatch {
    pub purge_state: Option<PurgeState>,
    pub favorite: Option<bool>,
    pub rating: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    pub path: String,
    pub migration_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub source_id: String,
    pub scanned: u64,
    pub added: u64,
    pub updated: u64,
    pub skipped: u64,
    pub phase: String,
    pub current_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFolderNode {
    pub rel_path: String,
    pub name: String,
    pub count: i64,
    pub children: Vec<SourceFolderNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResult {
    pub media_id: String,
    pub thumb_path: String,
}
