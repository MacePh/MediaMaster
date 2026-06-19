CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  live INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  ext TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_sec REAL,
  codec TEXT,
  bitrate INTEGER,
  fps REAL,
  created_at INTEGER,
  modified_at INTEGER,
  thumb_path TEXT,
  purge_state TEXT NOT NULL DEFAULT 'unreviewed',
  favorite INTEGER NOT NULL DEFAULT 0,
  rating INTEGER,
  holding_batch_id TEXT,
  original_path TEXT,
  last_reviewed_at INTEGER,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  hotkey TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_tags (
  media_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (media_id, tag_id),
  FOREIGN KEY (media_id) REFERENCES media_items(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS purge_sessions (
  id TEXT PRIMARY KEY,
  source_filter_label TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  decisions_json TEXT NOT NULL DEFAULT '{}',
  undo_stack_json TEXT NOT NULL DEFAULT '[]',
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS purge_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES purge_sessions(id)
);

CREATE TABLE IF NOT EXISTS safe_delete_batches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  holding_path TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS safe_delete_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  original_path TEXT NOT NULL,
  holding_path TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES safe_delete_batches(id),
  FOREIGN KEY (media_id) REFERENCES media_items(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  inputs_json TEXT NOT NULL DEFAULT '[]',
  dest_path TEXT,
  params_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  command_text TEXT,
  error TEXT,
  undo_token TEXT,
  batch_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_items_source_id ON media_items(source_id);
CREATE INDEX IF NOT EXISTS idx_media_items_purge_state ON media_items(purge_state);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON media_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
