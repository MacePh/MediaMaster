import { useEffect } from "react";
import type { AuditFinding, AuditSeverity, SuggestedAction } from "../../lib/types";
import { useLibraryStore } from "../../stores/libraryStore";

function severityTone(severity: AuditSeverity): "action" | "warn" | "default" {
  if (severity === "action") {
    return "action";
  }
  if (severity === "warning") {
    return "warn";
  }
  return "default";
}

function actionButtonLabel(action: SuggestedAction): string {
  switch (action) {
    case "tag":
      return "Open Tagging Mode";
    case "safe_delete":
      return "Open Safe Delete";
    case "compress":
      return "Review for Compression";
    case "purge":
      return "Open Purge Mode";
    case "reveal":
      return "Review in Grid";
    case "review_grid":
    default:
      return "Review in Grid";
  }
}

function isPrimaryFinding(finding: AuditFinding): boolean {
  return (
    finding.suggestedAction === "safe_delete" ||
    finding.kind === "untagged_ai_render"
  );
}

export function AuditMode() {
  const findings = useLibraryStore((state) => state.auditFindings);
  const loadingAudit = useLibraryStore((state) => state.loadingAudit);
  const activeSourceId = useLibraryStore((state) => state.activeSourceId);
  const loadAuditFindings = useLibraryStore((state) => state.loadAuditFindings);
  const applyAuditFinding = useLibraryStore((state) => state.applyAuditFinding);

  useEffect(() => {
    void loadAuditFindings();
  }, [loadAuditFindings, activeSourceId]);

  return (
    <section className="screen on">
      <div className="bar">
        <div className="title">Media Audit</div>
        <div className="muted">
          Cleanup opportunities generated from the local SQLite catalog
          {activeSourceId !== "all" ? " (scoped to active source)" : ""}
        </div>
        <div className="spacer" />
        <button
          className="btn primary"
          type="button"
          disabled={loadingAudit}
          onClick={() => void loadAuditFindings()}
        >
          {loadingAudit ? "Running…" : "Run Audit"}
        </button>
      </div>

      <div className="audit-grid">
        {findings.map((finding) => {
          const count = finding.itemIds.length;
          const tone = severityTone(finding.severity);
          const primary = isPrimaryFinding(finding);

          return (
            <div
              key={finding.id}
              className={`audit-card ${tone === "action" ? "action" : tone === "warn" ? "warn" : ""}`}
            >
              <div className="num">{count}</div>
              <div className="label">{finding.label}</div>
              <p>{finding.detail}</p>
              <button
                className={`btn ${primary ? "primary" : ""}`}
                type="button"
                disabled={count === 0}
                onClick={() => void applyAuditFinding(finding)}
              >
                {actionButtonLabel(finding.suggestedAction)}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
