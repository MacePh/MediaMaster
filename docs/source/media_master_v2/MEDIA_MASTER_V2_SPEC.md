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

---

## Delivery phases

### Phase 0 — Scaffold + shell (Slice 0) ✓

- Tauri v2 + React + TypeScript + Vite; mockup shell; mode switching

### Phase 1 — SQLite foundation (Slice 1) ✓

- rusqlite, migrations, models, command registration

### Phase 2 — Scan + catalog (Slice 2) ✓

- Folder dialog, recursive scanner, upsert media_items

### Phase 3 — Browse + thumbnails (Slice 3) ✓

- Thumbnailer, paginated list_media, inspector, filters, folder tree, context menu

### Phase 4 — Purge (Slice 4) partial ✓

- Keyboard UI; `update_media_state` persists decisions; session API stubbed

### Phase 5 — Tagging (Slice 5) partial ✓

- create_tag, assign_tags, tag filter; rename/remove stubbed

### Phase 6 — Safe Delete (Slice 6) ✓

- Holding move per source root; preview + confirm; restore; final delete disabled

### Phase 7 — Audit (Slice 7) ✓

- Query-based findings, navigable cards with `itemIds` filter

### Phase 8 — Jobs + FFmpeg (Slice 8) ✓

- Job runner with persisted queue; holding move/restore as background jobs
- FFprobe batch metadata scan from Audit

### Phase 9 — Polish (Slice 9) **← current**

- Job runner, tray UI; FFprobe batch metadata

### Phase 9 — Polish (Slice 9)

- Empty/loading/error states, toasts, keyboard hints, app icon

---

## v1 acceptance checklist

- [x] Launch desktop app on Windows
- [x] Add source folder via dialog
- [x] Scan persists media to SQLite
- [x] Thumbnail grid + inspector with real files
- [x] Select images → enter Purge Mode
- [x] Left/right keyboard marks keep/reject (persisted via `update_media_state`)
- [x] Finish → review rejected list (Safe Delete loads from DB)
- [ ] Move rejects to per-source holding folder (confirmed)
- [x] Create tag + assign selected thumbnails
- [x] App never permanently deletes files

---

## Current implementation status (2026-06)

Phases **0–3**, **3b**, **6**, and **7** are shipped. **Phase 4–5** core paths work.

| Area | Feature |
|------|---------|
| Browse | Folder tree, tag/folder filters, pagination, prefetch, context menu, viewer |
| Sources | Add/remove (catalog only), trees reload on startup |
| Purge | Hero preview, persisted purge_state, undo |
| Tagging | Create + assign + sidebar filter |
| Safe Delete | DB-backed rejects; holding move + restore |
| Audit | Query findings; navigate to fix workflows |

See [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) for commits.

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
