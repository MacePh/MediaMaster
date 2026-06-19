# Media Master v2

Local-first desktop media cleanup cockpit for Windows.

## Stack

- Tauri v2
- React + TypeScript + Vite
- Rust + SQLite (rusqlite)
- Zustand

## Development

```bash
npm install
npm run tauri dev
```

## Current milestone

Slice 0 + Slice 1:

- Desktop shell with Browse, Purge, Tagging, Safe Delete, Audit, and Jobs tray
- Mock media grid for UI development
- SQLite initialized on startup with initial migration
- Empty Tauri command stubs registered for later slices
