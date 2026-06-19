# Media Master v2 — Source Documentation

Product documentation for the Media Master v2 local-first media cleanup cockpit.

## Documents

| Document | Description |
|----------|-------------|
| [MEDIA_MASTER_V2_SPEC.md](./MEDIA_MASTER_V2_SPEC.md) | Full product specification: workflows, safety model, data model, and delivery phases |
| [MEDIA_MASTER_V2_ARCHITECTURE.md](./MEDIA_MASTER_V2_ARCHITECTURE.md) | Implementation architecture: stack, folder layout, IPC commands, and service boundaries |
| [media-master-v2-mockup.html](./media-master-v2-mockup.html) | Clickable HTML mockup of the desktop UI shell and all five modes |

## Quick summary

Media Master v2 is a **Windows-first desktop triage cockpit** for messy AI image/video folders, camera dumps, and phone backups. It is not a file manager — it is a decision engine backed by a local SQLite catalog.

Core workflows:

1. **Browse** — scan sources, thumbnail grid, inspect metadata, multi-select
2. **Purge** — keyboard culling (← reject, → keep, ↓ maybe); metadata only, never deletes
3. **Tagging** — bulk subject/dataset tagging separate from purge decisions
4. **Safe Delete** — move rejects to per-source `_MediaMaster_Holding/` folders; restore before any final delete
5. **Audit** — actionable cleanup cards driven by catalog queries

Stack: Tauri v2 · React + TypeScript · Rust · SQLite · FFmpeg/FFprobe (optional).

Open the HTML mockup in a browser to explore the UI shell before running the app.
