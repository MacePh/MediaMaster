# Media Master v2 — Source Documentation

Product documentation for the Media Master v2 local-first media cleanup cockpit.

## Documents

| Document | Description |
|----------|-------------|
| [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) | Running implementation log: slices shipped, features added during build |
| [MEDIA_MASTER_V2_SPEC.md](./MEDIA_MASTER_V2_SPEC.md) | Full product specification: workflows, safety model, data model, and delivery phases |
| [MEDIA_MASTER_V2_ARCHITECTURE.md](./MEDIA_MASTER_V2_ARCHITECTURE.md) | Implementation architecture: stack, folder layout, IPC commands, and service boundaries |
| [media-master-v2-mockup.html](./media-master-v2-mockup.html) | Clickable HTML mockup of the desktop UI shell and all five modes |

## Quick summary

Media Master v2 is a **Windows-first desktop triage cockpit** for messy AI image/video folders, camera dumps, and phone backups. It is not a file manager — it is a decision engine backed by a local SQLite catalog.

Core workflows (implementation status):

1. **Browse** ✓ — scan, thumbnail grid, folder tree, tag filter, pagination, context menu, viewer
2. **Purge** ✓ — keyboard culling; `purge_state` persisted to SQLite
3. **Tagging** ✓ — create/assign tags; bulk tagging mode
4. **Safe Delete** in progress — DB reject list; holding folder move
5. **Audit** — stub UI; query backend not wired

Stack: Tauri v2 · React + TypeScript · Rust · SQLite · FFmpeg/FFprobe (optional).

**Current phase:** Slice 6 — Safe Delete. See [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md).

Open the HTML mockup in a browser to explore the UI shell before running the app.
