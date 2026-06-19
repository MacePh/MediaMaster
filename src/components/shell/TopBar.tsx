import type { AppMode } from "../../lib/types";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { FfmpegStatusIcon } from "./FfmpegStatusIcon";
import { Kbd } from "../shared/Kbd";

const MODES: Array<{ id: AppMode; label: string }> = [
  { id: "browse", label: "Browse" },
  { id: "purge", label: "Purge" },
  { id: "tagging", label: "Tagging" },
  { id: "safe_delete", label: "Safe Delete" },
  { id: "audit", label: "Audit" },
];

export function TopBar() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const search = useLibraryStore((state) => state.search);
  const setSearch = useLibraryStore((state) => state.setSearch);

  return (
    <header className="top">
      <div className="brand">
        <div className="glyph">M</div>
        <div className="brand-name">
          Media<b>Master</b> v2
        </div>
      </div>

      <div className="search">
        <span>⌕</span>
        <input
          placeholder="Filter by name, tag, codec, state…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Kbd>Ctrl K</Kbd>
      </div>

      <nav className="modes">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            className={mode === entry.id ? "on" : ""}
            onClick={() => setMode(entry.id)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="spacer" />

      <FfmpegStatusIcon />
    </header>
  );
}
