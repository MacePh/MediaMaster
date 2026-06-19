import { useEffect } from "react";
import { gradientForHue } from "../../lib/mockData";
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
  const currentItem = usePurgeStore((state) => state.currentItem);
  const sessionCounts = usePurgeStore((state) => state.sessionCounts);
  const remaining = usePurgeStore((state) => state.remaining);
  const startSession = usePurgeStore((state) => state.startSession);
  const visibleItems = useLibraryStore((state) => state.visibleItems());

  useEffect(() => {
    if (sessionItems.length === 0 && visibleItems.length > 0) {
      startSession(visibleItems.filter((item) => item.kind === "image"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = currentItem();
  const counts = sessionCounts();

  const applyDecision = (state: "keep" | "reject" | "maybe") => {
    if (!current) {
      return;
    }

    markCurrent(state);
    updateItemState(current.id, state);
    showToast(`Marked ${current.name} as ${state}`);
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
        undo();
        showToast("Last purge decision undone");
      }
      if (event.key === "Enter") {
        setMode("safe_delete");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index]);

  if (!current) {
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

  return (
    <section className="screen on">
      <div className="purge">
        <div className="bar">
          <div className="title">Purge Mode</div>
          <div className="muted">
            {Math.min(index + 1, sessionItems.length)} / {sessionItems.length} ·{" "}
            {remaining()} remaining · arrows make metadata decisions only
          </div>
          <div className="spacer" />
          <button className="btn" type="button" onClick={undo}>
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

          <div className="hero" style={{ background: gradientForHue(current.hue) }}>
            <div className="decision left">REJECT</div>
            <div className="decision right">KEEP</div>
            <div className="mark">{current.ext}</div>
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
