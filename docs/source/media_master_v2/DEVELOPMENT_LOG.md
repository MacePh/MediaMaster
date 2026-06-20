# Media Master v2 — Development Log

Running record of implementation slices and features added during build-out. Complements the [spec](./MEDIA_MASTER_V2_SPEC.md) and [architecture](./MEDIA_MASTER_V2_ARCHITECTURE.md) docs.

---

## Slice 0 — Scaffold (commit `64a8a3d`)

- Tauri v2 + React + TypeScript + Vite shell
- Five mode screens (Browse, Purge, Tagging, Safe Delete, Audit) from HTML mockup
- Zustand stores, dark UI shell, sidebar/top bar/right panel layout

## Slice 1 — Stability & tooling (commit `b73dc0d`)

- Fixed Zustand selector patterns that caused infinite re-renders
- FFmpeg/FFprobe detection command + status icon in top bar
- Architecture and spec docs checked into `docs/source/media_master_v2/`

## Slice 2 — Catalog & scan (commit `485a532`)

- SQLite schema + migrations
- Folder picker → `add_source` → recursive `scan_source` (WalkDir)
- `list_media`, `list_sources`, `list_tags` IPC wired to frontend
- Scan progress events + sidebar source counts
- Empty states when no sources / no media

## Slice 3 — Browse polish (commit `0f9ac68`, local)

- Thumbnail generation service (`ensure_thumbnails`) + lazy batching
- Asset protocol for loading local image paths in the webview
- Real tagging: `create_tag`, `assign_tags`, tag names on media rows
- Browse interaction model: single-click focus, checkbox select mode, shift range
- Fullscreen `MediaViewerModal` (double-click, arrow keys, Esc)
- Inspector preview via `convertFileSrc` in right panel

## Slice 3b — Sidebar, performance & context (in progress)

### Browse / catalog UX

| Feature | Status | Notes |
|---------|--------|-------|
| Expandable source folder tree | Done | `list_source_folders`, nested sidebar, counts per folder |
| Folder-scoped grid filter | Done | Click subfolder → filter; click parent source → all under source |
| Tag filter in sidebar | Done | Toggle tag to filter grid; combines with source/folder |
| Paginated `list_media` | Done | 100 items/page (max 200 server-side) |
| Background page prefetch | Done | Auto-loads ahead (~200 items) without blocking UI |
| Infinite scroll sentinel | Done | Loads next page when scrolling near bottom |
| Stale-request guard | Done | Generation token ignores outdated folder/tag switches |
| Refreshing indicator | Done | Clears grid on filter change; shows "updating…" in bar |

### Purge mode

| Feature | Status | Notes |
|---------|--------|-------|
| Live hero image preview | Done | Uses file or thumbnail via `convertFileSrc` |
| Decision overlay only after label | Done | REJECT/KEEP/MAYBE badges appear only when state is set |

### Context menu (Browse grid)

| Feature | Status | Notes |
|---------|--------|-------|
| Reveal in Explorer | Done | `revealItemInDir` (Tauri opener plugin) |
| Copy image to clipboard | Done | Rust `copy_image_to_clipboard` (arboard) — paste into other apps |

### Slice 4 — Purge persistence (partial)

| Feature | Status | Notes |
|---------|--------|-------|
| Persist `purge_state` to SQLite | Done | `update_media_state` on each keep/reject/maybe |
| Folder trees on app restart | Done | `loadFolderTrees` runs during `loadCatalog` |
| Remove source from library | Done | × button on hover; removes catalog rows, not files on disk |
| Global purge count query | Planned | Sidebar counts still reflect loaded page only |

### Planned next (not yet built)

- Context menu on viewer / purge hero
- Copy file path, open with default app
- Persist purge decisions to SQLite (`mark_purge_decision` backend)
- Safe Delete holding folder moves
- Audit cards from real queries

---

## How to extend this log

When landing a feature not in the original spec, add a row to the relevant table with **Status** and **Notes**. When closing a slice, note the git commit hash.
