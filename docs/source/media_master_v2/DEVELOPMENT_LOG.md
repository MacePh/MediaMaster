# Media Master v2 — Development Log

Running record of implementation slices and features. Complements the [spec](./MEDIA_MASTER_V2_SPEC.md) and [architecture](./MEDIA_MASTER_V2_ARCHITECTURE.md).

**Current focus:** Slice 9 — Polish

---

## Slice 8 — Jobs + FFmpeg ✓

| Feature | Status | Notes |
|---------|--------|-------|
| `services/job_runner.rs` | Done | Single-worker queue, SQLite persistence |
| `services/ffprobe.rs` | Done | Batch metadata via FFprobe JSON |
| Holding move as job | Done | Progress events + cancel |
| Holding restore as job | Done | Same queue |
| `enqueue_ffprobe_scan` | Done | From Audit probe finding |
| Jobs tray (real backend) | Done | Progress, cancel, clear finished |
| `job:progress` / `job:done` events | Done | App + jobsStore listeners |

---

## Slice 9 — Polish (next)

- Empty/loading/error states, toasts, keyboard hints, app icon

---

## Slice 7 — Audit ✓

| Feature | Status | Notes |
|---------|--------|-------|
| `services/audit.rs` | Done | Query-based findings from SQLite |
| `run_media_audit` | Done | Thresholds from `app_settings` |
| Untagged AI renders | Done | Path heuristics + no tags |
| Large videos / huge PNGs | Done | 1 GB / 20 MB defaults |
| Rejects pending | Done | Links to Safe Delete |
| Duplicate candidates | Done | Same name + size groups |
| Not H.265 / probe pending | Done | Codec metadata queries |
| Audit cards → modes | Done | `itemIds` filter + navigation |

---

## Slice 0 — Scaffold (`64a8a3d`)

- Tauri v2 + React + TypeScript + Vite shell
- Five mode screens (Browse, Purge, Tagging, Safe Delete, Audit)
- Zustand stores, dark UI shell, sidebar / top bar / right panel / jobs tray layout

## Slice 1 — Stability & tooling (`b73dc0d`)

- Fixed Zustand selector patterns (infinite re-render loops)
- FFmpeg/FFprobe detection + status icon in top bar
- Spec and architecture docs in repo

## Slice 2 — Catalog & scan (`485a532`)

- SQLite schema + migrations (`0001_initial.sql`)
- Folder picker → `add_source` → recursive `scan_source` (WalkDir)
- `list_media`, `list_sources`, `list_tags` IPC wired to frontend
- Scan progress events + sidebar source counts
- Empty states when no sources / no media

## Slice 3 — Browse polish (`0f9ac68`)

- Thumbnail service (`ensure_thumbnails`) + lazy batched generation (24/call)
- Tauri asset protocol for local image paths in webview
- Real tagging: `create_tag`, `assign_tags`, tag names on media rows
- Browse UX: single-click focus, checkbox select mode, shift range select
- Fullscreen `MediaViewerModal` (double-click, ←/→, Esc)
- Inspector preview via `convertFileSrc` in right panel

## Slice 3b — Sidebar, performance & context (`da5d453`, `10b15d4`)

### Browse / catalog

| Feature | Commit | Notes |
|---------|--------|-------|
| Expandable source folder tree | `da5d453` | `list_source_folders`, `SourceFolderList`, counts per folder |
| Folder-scoped grid filter | `da5d453` | Subfolder click filters; parent source shows all under root |
| Tag filter in sidebar | `da5d453` | Toggle tag; combines with source/folder filter |
| Paginated `list_media` | `da5d453` | 100 items/page (max 200 server-side) |
| Background page prefetch | `da5d453` | ~200 items buffered ahead, throttled |
| Infinite scroll sentinel | `da5d453` | Loads next page near bottom of grid |
| Stale-request guard | `da5d453` | `mediaRefreshGeneration` drops outdated responses |
| Refreshing indicator | `da5d453` | Grid clears on filter change; bar shows "updating…" |
| Folder trees on restart | `10b15d4` | `loadFolderTrees()` during `loadCatalog` |
| Remove source | `10b15d4` | × on hover; removes catalog rows, not disk files |

### Purge mode

| Feature | Commit | Notes |
|---------|--------|-------|
| Live hero image preview | `da5d453` | `convertFileSrc(filePath \|\| thumbPath)` |
| Decision overlay after label only | `da5d453` | REJECT/KEEP/MAYBE shown only when state set |
| Persist `purge_state` to SQLite | `10b15d4` | `update_media_state` on each decision + undo |
| State badge on browse tiles | `10b15d4` | keep/reject/maybe on thumbnail; unreviewed hidden |

### Context menu (browse grid)

| Feature | Commit | Notes |
|---------|--------|-------|
| Reveal in Explorer | `da5d453` | `revealItemInDir` (opener plugin) |
| Copy image to clipboard | `da5d453` | `copy_image_to_clipboard` (arboard) |

### Not tags — purge state vs tags

| | Purge state | Tags |
|---|-------------|------|
| Column | `media_items.purge_state` | `media_tags` + `tags` |
| Question | Keep or reject? | What subject/project? |
| Set in | Purge Mode | Tagging Mode |
| Values | unreviewed, keep, reject, maybe | User-defined names |

---

## Slice 4 — Purge backend (partial)

| Feature | Status | Notes |
|---------|--------|-------|
| `update_media_state` | Done | Direct persist path (not session API yet) |
| Purge keyboard + undo UI | Done | Undo restores DB via `update_media_state` |
| `start_purge_session` / `mark_purge_decision` | Stub | Session tables exist; commands return Slice 4 error |
| `list_rejects` | Done | Moved to Slice 6 |
| Global purge sidebar counts | Planned | Counts reflect loaded page only |

**Acceptance (partial):** Arrow keys persist across restart; undo works; rejects visible on tiles in Browse.

---

## Slice 5 — Tagging (mostly done)

| Feature | Status | Notes |
|---------|--------|-------|
| Create tag | Done | Tagging mode + `create_tag` |
| Assign to selection | Done | `assign_tags` |
| Tag filter in sidebar | Done | Slice 3b |
| Tag hotkeys 1–9 | Planned | |
| Rename / remove tag | Stub | Commands registered, not implemented |

---

## Slice 6 — Safe Delete ✓

| Feature | Status | Notes |
|---------|--------|-------|
| `list_rejects` from SQLite | Done | Rejects where `holding_batch_id IS NULL` |
| Safe Delete mode loads DB rejects | Done | Full catalog, not browse page only |
| `preview_holding_move` | Done | Byte count + target holding roots |
| `move_to_holding` | Done | `{sourceRoot}/_MediaMaster_Holding/{label}/` |
| `list_holding_batches` | Done | Batch history from SQLite |
| `restore_holding_batch` | Done | Reverse move to `original_path` |
| Reveal holding folder in UI | Done | Open holding folder in Explorer |
| Rescue to maybe | Done | Selected rejects in Safe Delete |
| Sidebar holding list | Done | Restore per batch |
| Final delete | Disabled | v1 safety constraint |

---

## Git history (main)

| Commit | Summary |
|--------|---------|
| `64a8a3d` | Scaffold |
| `b73dc0d` | Zustand fixes, FFmpeg, docs |
| `485a532` | Scanner + catalog |
| `0f9ac68` | Thumbnails, tagging, browse UX |
| `da5d453` | Folder tree, pagination, purge preview, context menu |
| `10b15d4` | Purge persist, folder trees on startup, remove source |
| `f7716ea` | Docs + Safe Delete holding move |

---

## How to extend this log

Add a row when landing a feature not in the original spec. Close a slice with commit hash and move **Current focus** to the next slice.
