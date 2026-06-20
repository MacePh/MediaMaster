import type { SourceFolderNode } from "../../lib/types";

interface SourceFolderListProps {
  sourceId: string;
  nodes: SourceFolderNode[];
  depth: number;
  activeSourceId: string;
  activeFolderRelPath: string | null;
  expandedFolders: Record<string, boolean>;
  onToggleExpand: (key: string) => void;
  onSelectFolder: (sourceId: string, relPath: string) => void;
}

function folderKey(sourceId: string, relPath: string) {
  return `${sourceId}::${relPath}`;
}

export function SourceFolderList({
  sourceId,
  nodes,
  depth,
  activeSourceId,
  activeFolderRelPath,
  expandedFolders,
  onToggleExpand,
  onSelectFolder,
}: SourceFolderListProps) {
  return (
    <>
      {nodes.map((node) => {
        const key = folderKey(sourceId, node.relPath);
        const isExpanded = expandedFolders[key] ?? false;
        const isActive =
          activeSourceId === sourceId && activeFolderRelPath === node.relPath;
        const hasChildren = node.children.length > 0;

        return (
          <div key={key}>
            <div
              className={`side-item side-item-folder ${isActive ? "active" : ""}`}
              style={{ paddingLeft: `${12 + depth * 14}px` }}
              onClick={() => onSelectFolder(sourceId, node.relPath)}
              role="button"
              tabIndex={0}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="side-folder-toggle"
                  aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpand(key);
                  }}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              ) : (
                <span className="side-folder-spacer" />
              )}
              <span className="sw side-folder-dot" />
              {node.name}
              <span className="count">{node.count.toLocaleString()}</span>
            </div>
            {hasChildren && isExpanded ? (
              <SourceFolderList
                sourceId={sourceId}
                nodes={node.children}
                depth={depth + 1}
                activeSourceId={activeSourceId}
                activeFolderRelPath={activeFolderRelPath}
                expandedFolders={expandedFolders}
                onToggleExpand={onToggleExpand}
                onSelectFolder={onSelectFolder}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}
