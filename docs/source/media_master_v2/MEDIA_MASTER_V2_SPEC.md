# Media Master v2 — Product Specification

## Vision

Media Master v2 is a **local-first media triage cockpit** for Windows. It targets messy folders produced by AI image pipelines (ComfyUI, Stable Diffusion outputs), camera dumps, phone backups, and general media hoarding — not day-to-day file management.

The product helps you **decide what to keep**, **organize subjects with tags**, and **remove rejects safely** without accidental permanent deletion.

## Design principles

1. **Metadata decisions before filesystem actions** — Purge Mode only updates catalog state; files stay on disk until Safe Delete.
2. **No silent deletes** — Every removal path goes through a holding folder with preview, confirmation, and restore.
3. **Separate culling from tagging** — Purge answers "keep or reject?"; Tagging answers "what subject/dataset is this?"
4. **Actionable audit, not reports** — Audit cards navigate directly into the workflow that fixes the problem.
5. **Local catalog as source of truth** — SQLite indexes paths, metadata, decisions, and job history; the filesystem is never blindly rescanned on every action.

## Target users

- AI artists with thousands of render outputs and no subject organization
- Photographers/videographers with large camera dumps needing fast culling
- Anyone with multi-source media libraries who wants a single review surface

## Platform

- **Primary:** Windows desktop (Tauri v2)
- **Future:** macOS/Linux after v1 checkpoint
- **Offline-first:** No cloud sync required; all data stays on the machine

---

## Workflows

### 1. Browse Mode

**Purpose:** Visual catalog of all indexed media across registered source folders.

**Capabilities:**

- Register one or more source folders (each gets a color label and item count)
- Recursive scan of supported extensions
- Thumbnail grid with lazy generation and cache invalidation on `modified_at`
- Click / Ctrl+click / Shift+click multi-selection
- Search by filename
- Filter by source, kind (image/video), purge state, tag
- Right inspector panel: preview, metadata table, future operation shortcuts
- Entry point: "Start Purge Mode" with selected images

**Supported extensions (v1):**

- Images: `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`, `tif`, `tiff`
- Video: `mp4`, `mov`, `mkv`, `avi`, `webm`, `m4v`

### 2. Purge Mode

**Purpose:** Fast keyboard-driven culling for images (videos supported with placeholder preview in v1).

**Behavior:**

- Session-based review of a filtered item list (typically selected images from Browse)
- Large hero preview with reject/keep pile counts on either side
- Decisions update `purge_state` in SQLite only — **no file deletion or movement**
- Undo stack per session (Z / Backspace)
- Summary on finish with count breakdown and CTA to Safe Delete

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| ← | Mark **reject** |
| → | Mark **keep** |
| ↓ | Mark **maybe** |
| Z | Undo last decision |
| Enter | Finish review → summary / Safe Delete |

**Purge states:** `unreviewed`, `keep`, `reject`, `maybe`

### 3. Tagging Mode

**Purpose:** Bulk manual subject/project/dataset tagging — intentionally separate from Purge.

**Behavior:**

- Larger grid tiles optimized for visual grouping
- Multi-select thumbnails, assign to existing tag or create new tag
- Optional hotkeys per tag (1–9)
- Filters: untagged, by tag, keepers only, rejects
- Tag chips visible on tiles in Browse after assignment

**Tag model:**

- Name (unique), color, optional hotkey
- Many-to-many with media items via `media_tags`

### 4. Safe Delete Mode

**Purpose:** Non-destructive removal path for rejected files.

**Three-step safety model:**

1. **Preview** — Review reject batch in grid; rescue items back to keep/maybe
2. **Move to holding** — Files relocated to `{sourceRoot}/_MediaMaster_Holding/{YYYY-MM-DD_HH-mm-ss}/` preserving relative paths from source root; conflict-safe naming (`_1`, `_2`, …)
3. **Final delete (post-v1)** — Browse holding folder, restore all, or permanently delete batch — **disabled in v1**

**Holding batch record:**

- Batch ID, label, holding path, status (`staged` → `moved` → `restored` | `deleted`)
- Per-item map: `original_path` → `holding_path`
- Restore moves files back to original paths with same conflict rules

**v1 constraint:** Permanent delete is stubbed/disabled in UI and backend.

### 5. Audit Mode

**Purpose:** Dashboard of cleanup opportunities computed from the SQLite catalog.

**Finding types (v1 — query-based, no expensive hashing):**

| Finding | Criteria | Suggested action |
|---------|----------|------------------|
| Untagged AI renders | Path contains `comfy`, `output`, `render`, etc. and no tags | Open Tagging Mode |
| Large videos | Size > 1 GB (configurable threshold) | Review in grid / compress |
| Huge PNG files | Image size > 20 MB | Convert to WebP |
| Rejects pending | `purge_state = reject` and not yet in holding | Open Safe Delete |
| Duplicate candidates | Same filename + size, group count > 1 | Compare in grid |
| Not H.265 | Video codec populated and not HEVC | Compress for archive |
| Probe failed | FFprobe could not read metadata | Reveal / rescan |

Each card shows count, description, and a button that navigates to the appropriate mode with filters applied.

### 6. Operations Queue (Jobs Tray)

**Purpose:** Visible async work for long-running operations.

**v1 job kinds:**

- `holding_move`, `holding_restore`
- `ffprobe_scan` (batch metadata for selected videos)
- Future: transcode, resize, proxy, extract frames, WebP conversion

Jobs show: name, operation detail, progress bar, status (queued/running/done/failed).

---

## Safety model (non-negotiable)

```
Purge (←/→)     →  updates purge_state only
Safe Delete     →  move to holding folder (preview + confirm)
Final delete    →  disabled in v1
Restore         →  always available before final delete
```

Every batch move requires preview and explicit confirmation. The app **never permanently deletes files in v1**.

---

## Data model

### sources

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| name | TEXT | Display label |
| path | TEXT UNIQUE | Absolute folder path |
| color | TEXT | Hex color for sidebar |
| live | INTEGER | 1 = active |
| created_at | INTEGER | Unix timestamp |

### media_items

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | SHA256(normalized path), truncated hex |
| source_id | TEXT FK | → sources |
| path | TEXT UNIQUE | Absolute file path |
| name | TEXT | Filename |
| kind | TEXT | `image` \| `video` |
| ext | TEXT | Extension |
| size_bytes | INTEGER | |
| width, height | INTEGER | Optional |
| duration_sec | REAL | Video only |
| codec, bitrate, fps | | From FFprobe |
| thumb_path | TEXT | Cached thumbnail |
| purge_state | TEXT | `unreviewed` \| `keep` \| `reject` \| `maybe` |
| favorite | INTEGER | Boolean |
| rating | INTEGER | Optional 1–5 |
| holding_batch_id | TEXT | Set after holding move |
| original_path | TEXT | Pre-move path |
| created_at, modified_at | INTEGER | File timestamps |
| last_reviewed_at | INTEGER | Last purge decision |

### tags + media_tags

Standard many-to-many: tags have `id`, `name` (unique), `color`, `hotkey`, `created_at`.

### purge_sessions + purge_decisions

Session tracks: source filter label, item ID list, current index, decisions map, undo stack JSON, timestamps.

### safe_delete_batches + safe_delete_items

Batch: `id`, `label`, `holding_path`, `status`, `created_at`.

Items: `batch_id`, `media_id`, `original_path`, `holding_path`.

### jobs

`id`, `kind`, `label`, `inputs_json`, `dest_path`, `params_json`, `status`, `progress`, `command_text`, `error`, `undo_token`, `batch_id`, timestamps.

### app_settings

Key/value store for FFmpeg path override, audit thresholds, etc.

---

## UI shell

CSS grid layout:

```
┌─────────────────────────────────────────────────────────┐
│ Top bar: brand · search · mode switcher · FFmpeg pill   │
├──────────┬──────────────────────────────┬─────────────┤
│ Sidebar  │ Main content (active mode)   │ Inspector   │
│ 260px    │                              │ 340px       │
├──────────┴──────────────────────────────┴─────────────┤
│ Jobs tray (128px)                                       │
└─────────────────────────────────────────────────────────┘
```

**Modes:** `browse` · `purge` · `tagging` · `safe_delete` · `audit` (no URL router — single-window mode state)

**Visual tokens:** Dark theme, amber accent, Space Grotesk + Inter + JetBrains Mono.

See [media-master-v2-mockup.html](./media-master-v2-mockup.html) for the interactive prototype.

---

## Delivery phases

### Phase 0 — Scaffold + shell (Slice 0)

- Tauri v2 + React + TypeScript + Vite
- Port mockup CSS and shell components
- Zustand mode state
- Mock data in Browse/Purge/Tagging

**Accept:** App launches; all five modes switch; mock grid and purge keyboard demo work.

### Phase 1 — SQLite foundation (Slice 1)

- rusqlite, initial migration, models, stub Tauri commands
- DB at `{app_data_dir}/media_master.db`

**Accept:** App restart creates/uses SQLite; commands registered.

### Phase 2 — Scan + catalog (Slice 2)

- Folder dialog, recursive scanner, progress events
- Upsert media_items; skip unchanged on rescan

**Accept:** Choose folder → files in DB → persist across restart.

### Phase 3 — Browse + thumbnails (Slice 3)

- Thumbnailer (image crate + FFmpeg frame extract)
- Paginated `list_media`, inspector, filters

**Accept:** Real thumbnail grid; multi-select; metadata panel.

### Phase 4 — Purge (Slice 4)

- Session commands, keyboard UI, persist purge_state

**Accept:** Arrow keys persist; undo works; rejects queryable after restart.

### Phase 5 — Tagging (Slice 5)

- Tag CRUD, assign/remove, untagged filter

**Accept:** Create tag → assign → filter → persists.

### Phase 6 — Safe Delete (Slice 6)

- Holding move/restore service per source root
- Preview + confirm; final delete disabled

**Accept:** Rejects move to holding; restore works; nothing permanently deleted.

### Phase 7 — Audit (Slice 7)

- Query-based findings, navigable cards

**Accept:** Cards reflect real counts; actions open correct mode.

### Phase 8 — Jobs + FFmpeg (Slice 8)

- Job runner, tray UI, FFmpeg/FFprobe detection

**Accept:** Holding move as job; FFprobe updates codec fields.

### Phase 9 — Polish (Slice 9)

- Empty/loading/error states, toasts, keyboard hints, app icon

---

## v1 acceptance checklist

- [ ] Launch desktop app on Windows
- [ ] Add source folder via dialog
- [ ] Scan persists media to SQLite
- [ ] Thumbnail grid + inspector with real files
- [ ] Select images → enter Purge Mode
- [ ] Left/right keyboard marks keep/reject
- [ ] Finish → review rejected list
- [ ] Move rejects to per-source holding folder (confirmed)
- [ ] Create tag + assign selected thumbnails
- [ ] App never permanently deletes files

---

## Out of scope (post-v1)

- Collections / smart albums
- Watch folders / live rescan
- NVENC transcode recipes
- Perceptual duplicate hashing
- Permanent delete workflow
- Cloud sync or multi-user

---

## Risks

| Risk | Mitigation |
|------|------------|
| Large folders (10k+ files) | Paginate list_media; lazy thumbnails; scan progress events |
| FFmpeg missing | Placeholder video thumbs; skip codec audit; settings hint |
| Windows path encoding | Normalize paths before hashing IDs; use `std::path` throughout |
| Scope creep | Strict slice gates; defer collections and final delete |
