use rusqlite::{Connection, Result};

const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial.sql");

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )",
        [],
    )?;

    apply_migration(conn, "0001_initial", MIGRATION_0001)
}

fn apply_migration(conn: &Connection, version: &str, sql: &str) -> Result<()> {
    let already_applied: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM schema_migrations WHERE version = ?1",
        [version],
        |row| row.get(0),
    )?;

    if already_applied {
        return Ok(());
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0);

    conn.execute_batch(sql)?;
    conn.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        (version, now),
    )?;

    Ok(())
}
