use crate::models::{
    AuditFinding, AuditFindingKind, AuditSeverity, MediaFilter, SuggestedAction,
};
use rusqlite::{params_from_iter, Connection, ToSql};

const DEFAULT_LARGE_VIDEO_BYTES: i64 = 1_073_741_824;
const DEFAULT_LARGE_IMAGE_BYTES: i64 = 20_971_520;

struct AuditConfig {
    large_video_bytes: i64,
    large_image_bytes: i64,
}

pub fn run_audit(
    conn: &Connection,
    filter: Option<&MediaFilter>,
) -> Result<Vec<AuditFinding>, String> {
    let config = load_config(conn)?;
    let scope = FilterScope::from(filter);

    let mut findings = Vec::new();

    findings.push(build_finding(
        AuditFindingKind::UntaggedAiRender,
        "Untagged AI renders",
        "Likely ComfyUI or render outputs with no subject or dataset tag yet.".into(),
        query_untagged_ai_renders(conn, &scope)?,
        AuditSeverity::Action,
        SuggestedAction::Tag,
    ));

    findings.push(build_finding(
        AuditFindingKind::LargeVideo,
        "Large videos",
        format!(
            "Videos over {} GB. Good candidates for archive compression.",
            config.large_video_bytes as f64 / 1_073_741_824.0
        ),
        query_large_videos(conn, &scope, config.large_video_bytes)?,
        AuditSeverity::Warning,
        SuggestedAction::ReviewGrid,
    ));

    findings.push(build_finding(
        AuditFindingKind::LargeImage,
        "Huge PNG files",
        format!(
            "PNG images over {} MB. Convert keepers to WebP or archive originals.",
            config.large_image_bytes as f64 / (1024.0 * 1024.0)
        ),
        query_huge_pngs(conn, &scope, config.large_image_bytes)?,
        AuditSeverity::Action,
        SuggestedAction::ReviewGrid,
    ));

    findings.push(build_finding(
        AuditFindingKind::RejectsPending,
        "Rejects waiting",
        "Purge decisions exist, but files have not been moved to holding.".into(),
        query_rejects_pending(conn, &scope)?,
        AuditSeverity::Action,
        SuggestedAction::SafeDelete,
    ));

    findings.push(build_finding(
        AuditFindingKind::DuplicateCandidate,
        "Duplicate candidates",
        "Same filename and size appear more than once in the catalog.".into(),
        query_duplicate_candidates(conn, &scope)?,
        AuditSeverity::Info,
        SuggestedAction::ReviewGrid,
    ));

    findings.push(build_finding(
        AuditFindingKind::NotHevc,
        "Not H.265",
        "Video files with known codec metadata that is not HEVC.".into(),
        query_not_hevc(conn, &scope)?,
        AuditSeverity::Info,
        SuggestedAction::Compress,
    ));

    findings.push(build_finding(
        AuditFindingKind::ProbeFailed,
        "Videos missing metadata",
        "Video files without codec or duration metadata yet.".into(),
        query_probe_pending(conn, &scope)?,
        AuditSeverity::Info,
        SuggestedAction::ReviewGrid,
    ));

    Ok(findings)
}

struct FilterScope {
    source_id: Option<String>,
}

impl FilterScope {
    fn from(filter: Option<&MediaFilter>) -> Self {
        Self {
            source_id: filter.and_then(|value| value.source_id.clone()),
        }
    }

    fn clause(&self) -> (&'static str, Vec<Box<dyn ToSql>>) {
        if let Some(ref source_id) = self.source_id {
            (
                " AND source_id = ?",
                vec![Box::new(source_id.clone())],
            )
        } else {
            ("", Vec::new())
        }
    }

    fn scoped_params(&self, repeats: usize) -> Vec<Box<dyn ToSql>> {
        let mut params: Vec<Box<dyn ToSql>> = Vec::new();
        if let Some(ref source_id) = self.source_id {
            for _ in 0..repeats {
                params.push(Box::new(source_id.clone()));
            }
        }
        params
    }
}

fn load_config(conn: &Connection) -> Result<AuditConfig, String> {
    Ok(AuditConfig {
        large_video_bytes: setting_i64(
            conn,
            "audit_large_video_bytes",
            DEFAULT_LARGE_VIDEO_BYTES,
        )?,
        large_image_bytes: setting_i64(
            conn,
            "audit_large_image_bytes",
            DEFAULT_LARGE_IMAGE_BYTES,
        )?,
    })
}

fn setting_i64(conn: &Connection, key: &str, default: i64) -> Result<i64, String> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            rusqlite::params![key],
            |row| row.get(0),
        )
        .ok();

    match value {
        Some(raw) => raw.parse::<i64>().map_err(|error| error.to_string()),
        None => Ok(default),
    }
}

fn build_finding(
    kind: AuditFindingKind,
    label: &str,
    detail: String,
    item_ids: Vec<String>,
    severity: AuditSeverity,
    suggested_action: SuggestedAction,
) -> AuditFinding {
    AuditFinding {
        id: finding_id(&kind),
        kind,
        label: label.to_string(),
        detail,
        item_ids,
        severity,
        suggested_action,
    }
}

fn finding_id(kind: &AuditFindingKind) -> String {
    match kind {
        AuditFindingKind::LargeVideo => "large_video".into(),
        AuditFindingKind::LargeImage => "large_image".into(),
        AuditFindingKind::NotHevc => "not_hevc".into(),
        AuditFindingKind::DuplicateCandidate => "duplicate_candidate".into(),
        AuditFindingKind::UntaggedAiRender => "untagged_ai_render".into(),
        AuditFindingKind::RejectsPending => "rejects_pending".into(),
        AuditFindingKind::HoldingPending => "holding_pending".into(),
        AuditFindingKind::ProbeFailed => "probe_failed".into(),
    }
}

fn query_ids(conn: &Connection, sql: &str, params: Vec<Box<dyn ToSql>>) -> Result<Vec<String>, String> {
    let mut stmt = conn.prepare(sql).map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(
            params_from_iter(params.iter().map(|value| value.as_ref())),
            |row| row.get::<_, String>(0),
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(rows)
}

fn query_untagged_ai_renders(conn: &Connection, scope: &FilterScope) -> Result<Vec<String>, String> {
    let (scope_clause, params) = scope.clause();
    let sql = format!(
        "SELECT id FROM media_items
         WHERE id NOT IN (SELECT media_id FROM media_tags)
           AND (
             LOWER(path) LIKE '%comfy%'
             OR LOWER(path) LIKE '%output%'
             OR LOWER(path) LIKE '%render%'
           ){scope_clause}
         ORDER BY modified_at DESC"
    );
    query_ids(conn, &sql, params)
}

fn query_large_videos(
    conn: &Connection,
    scope: &FilterScope,
    threshold: i64,
) -> Result<Vec<String>, String> {
    let (scope_clause, mut params) = scope.clause();
    params.insert(0, Box::new(threshold));
    let sql = format!(
        "SELECT id FROM media_items
         WHERE kind = 'video' AND size_bytes > ?{scope_clause}
         ORDER BY size_bytes DESC"
    );
    query_ids(conn, &sql, params)
}

fn query_huge_pngs(
    conn: &Connection,
    scope: &FilterScope,
    threshold: i64,
) -> Result<Vec<String>, String> {
    let (scope_clause, mut params) = scope.clause();
    params.insert(0, Box::new(threshold));
    let sql = format!(
        "SELECT id FROM media_items
         WHERE kind = 'image' AND LOWER(ext) = 'png' AND size_bytes > ?{scope_clause}
         ORDER BY size_bytes DESC"
    );
    query_ids(conn, &sql, params)
}

fn query_rejects_pending(conn: &Connection, scope: &FilterScope) -> Result<Vec<String>, String> {
    let (scope_clause, params) = scope.clause();
    let sql = format!(
        "SELECT id FROM media_items
         WHERE purge_state = 'reject' AND holding_batch_id IS NULL{scope_clause}
         ORDER BY modified_at DESC"
    );
    query_ids(conn, &sql, params)
}

fn query_duplicate_candidates(conn: &Connection, scope: &FilterScope) -> Result<Vec<String>, String> {
    let (scope_clause, _) = scope.clause();
    let params = scope.scoped_params(2);
    let sql = format!(
        "SELECT m.id FROM media_items m
         INNER JOIN (
           SELECT name, size_bytes
           FROM media_items
           WHERE 1 = 1{scope_clause}
           GROUP BY name, size_bytes
           HAVING COUNT(*) > 1
         ) dup ON m.name = dup.name AND m.size_bytes = dup.size_bytes
         WHERE 1 = 1{scope_clause}
         ORDER BY m.name ASC, m.size_bytes DESC"
    );
    query_ids(conn, &sql, params)
}

fn query_not_hevc(conn: &Connection, scope: &FilterScope) -> Result<Vec<String>, String> {
    let (scope_clause, params) = scope.clause();
    let sql = format!(
        "SELECT id FROM media_items
         WHERE kind = 'video'
           AND codec IS NOT NULL
           AND TRIM(codec) != ''
           AND LOWER(codec) NOT IN ('hevc', 'h265', 'h.265'){scope_clause}
         ORDER BY size_bytes DESC"
    );
    query_ids(conn, &sql, params)
}

fn query_probe_pending(conn: &Connection, scope: &FilterScope) -> Result<Vec<String>, String> {
    let (scope_clause, params) = scope.clause();
    let sql = format!(
        "SELECT id FROM media_items
         WHERE kind = 'video'
           AND (codec IS NULL OR TRIM(codec) = '')
           AND duration_sec IS NULL{scope_clause}
         ORDER BY modified_at DESC"
    );
    query_ids(conn, &sql, params)
}
