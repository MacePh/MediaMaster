import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { gradientForHue } from "../../lib/mockData";
import { useVisibleItems } from "../../hooks/useLibrarySelectors";
import {
  usePurgeCurrentItem,
  usePurgeRemaining,
  usePurgeSessionCounts,
} from "../../hooks/usePurgeSelectors";
import { Kbd } from "../../components/shared/Kbd";
import { TagChip } from "../../components/shared/TagChip";
import { useAppStore } from "../../stores/appStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePurgeStore } from "../../stores/purgeStore";

export function PurgeMode() {
  const setMode = useAppStore((state) => state.setMode);
  const showToast = useAppStore((state) => state.showToast);
  const updateItemState = useLibraryStore((state) => state.updateItemState);
  const sessionItems = usePurgeStore((state) => state.sessionItems);
  const index = usePurgeStore((state) => state.index);
  const markCurrent = usePurgeStore((state) => state.markCurrent);
  const undo = usePurgeStore((state) => state.undo);
  const startSession = usePurgeStore((state) => state.startSession);
  const visibleItems = useVisibleItems();
  const current = usePurgeCurrentItem();
  const counts = usePurgeSessionCounts();
  const remaining = usePurgeRemaining();
  const sessionComplete = sessionItems.length > 0 && index >= sessionItems.length;

  useEffect(() => {
    if (sessionItems.length === 0 && visibleItems.length > 0) {
      startSession(visibleItems.filter((item) => item.kind === "image"));
    }
  }, [sessionItems.length, visibleItems, startSession]);

  const applyDecision = (state: "keep" | "reject" | "maybe") => {
    if (!current || sessionComplete) {
      return;
    }

    markCurrent(state);
    updateItemState(current.id, state);
    showToast(`Marked ${current.name} as ${state}`);
  };

  const handleUndo = () => {
    const undoStack = usePurgeStore.getState().undoStack;
    const last = undoStack[undoStack.length - 1];
    if (!last) {
      return;
    }

    undo();
    updateItemState(last.itemId, last.previousState);
    showToast("Last purge decision undone");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        applyDecision("reject");
      }
      if (event.key === "ArrowRight") {
        applyDecision("keep");
      }
      if (event.key === "ArrowDown") {
        applyDecision("maybe");
      }
      if (event.key.toLowerCase() === "z") {
        handleUndo();
      }
      if (event.key === "Enter") {
        setMode("safe_delete");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index, sessionComplete]);

  const previewPath = current?.filePath || current?.thumbPath;
  const previewSrc = previewPath ? convertFileSrc(previewPath) : null;

  if (sessionItems.length === 0) {
    return (
      <section className="screen on">
        <div className="bar">
          <div className="title">Purge Mode</div>
          <div className="muted">No images available for culling.</div>
        </div>
        <div className="empty">Select images in Browse mode or add a source folder.</div>
      </section>
    );
  }

  if (sessionComplete) {
    return (
      <section className="screen on">
        <div className="bar">
          <div className="title">Purge Mode — Review Complete</div>
          <div className="muted">
            {counts.keep} keep · {counts.reject} reject · {counts.maybe} maybe
          </div>
          <div className="spacer" />
          <button className="btn" type="button" onClick={handleUndo}>
            Undo
          </button>
          <button className="btn primary" type="button" onClick={() => setMode("safe_delete")}>
            Finish Review
          </button>
        </div>
        <div className="empty">
          All {sessionItems.length} items reviewed. Open Safe Delete to preview rejects.
        </div>
      </section>
    );
  }

  if (!current) {
    return (
      <section className="screen on">
        <div className="bar">
          <div className="title">Purge Mode</div>
          <div className="muted">Waiting for session…</div>
        </div>
        <div className="empty">Loading purge session…</div>
      </section>
    );
  }

  return (
    <section className="screen on">
      <div className="purge">
        <div className="bar">
          <div className="title">Purge Mode</div>
          <div className="muted">
            {Math.min(index + 1, sessionItems.length)} / {sessionItems.length} ·{" "}
            {remaining} remaining · arrows make metadata decisions only
          </div>
          <div className="spacer" />
          <button className="btn" type="button" onClick={handleUndo}>
            Undo
          </button>
          <button className="btn primary" type="button" onClick={() => setMode("safe_delete")}>
            Finish Review
          </button>
        </div>

        <div className="purge-stage">
          <div className="pile reject">
            <div className="big">{counts.reject}</div>
            <div>marked reject</div>
            <button
              className="btn danger"
              style={{ marginTop: 14 }}
              type="button"
              onClick={() => applyDecision("reject")}
            >
              ← Reject
            </button>
          </div>

          <div
            className="hero"
            style={previewSrc ? undefined : { background: gradientForHue(current.hue) }}
          >
            {current.state === "reject" ? (
              <div className="decision left on">REJECT</div>
            ) : null}
            {current.state === "keep" ? (
              <div className="decision right on">KEEP</div>
            ) : null}
            {current.state === "maybe" ? (
              <div className="decision maybe on">MAYBE</div>
            ) : null}
            {previewSrc ? (
              <img src={previewSrc} alt={current.name} className="hero-img" />
            ) : (
              <div className="mark">{current.ext}</div>
            )}
            <div className="hero-info">
              <div>
                <div className="fn">{current.name}</div>
                <div className="muted">
                  {current.dim} · {current.ext} · {current.sizeLabel} · {current.sourceName}
                </div>
              </div>
              <div className="spacer" />
              {current.tag ? (
                <TagChip label={current.tag} tone="teal" />
              ) : (
                <TagChip label="untagged" tone="amber" />
              )}
              <TagChip label={current.state} />
            </div>
          </div>

          <div className="pile keep">
            <div className="big">{counts.keep}</div>
            <div>marked keep</div>
            <button
              className="btn"
              style={{ marginTop: 14, color: "var(--green)" }}
              type="button"
              onClick={() => applyDecision("keep")}
            >
              Keep →
            </button>
          </div>
        </div>

        <div className="kbdbar">
          <Kbd>←</Kbd> reject <Kbd>→</Kbd> keep <Kbd>↓</Kbd> maybe <Kbd>Z</Kbd> undo{" "}
          <Kbd>Enter</Kbd> summary
        </div>
      </div>
    </section>
  );
}
