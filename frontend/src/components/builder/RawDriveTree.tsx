"use client";

import React, { useState, useCallback, useMemo, useEffect, memo } from "react";
import { DriveNode } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "@/lib/utils";
import {
  Folder,
  FolderOpen,
  FileVideo,
  FileAudio,
  FileText,
  Image as ImageIcon,
  File,
  Search,
  Wand2,
  ChevronRight,
  ExternalLink,
  X,
  Home,
  ChevronRight as ArrowRightIcon,
} from "lucide-react";

interface RawDriveTreeProps {
  nodes: DriveNode[];
  onOpenAutoSuggest: (folderNode: DriveNode) => void;
  onSelectNodeForAssignment?: (node: DriveNode) => void;
}

/** Detect resource type from MIME/extension for DnD auto-classify */
function detectResourceType(node: DriveNode): number {
  const mime = node.mimeType.toLowerCase();
  const ext = (node.fileExtension || "").toLowerCase();
  if (mime.startsWith("video/") || [".mp4", ".mkv", ".mov", ".avi", ".webm"].includes(ext)) return 0;
  if (mime.startsWith("audio/") || [".mp3", ".m4a", ".wav", ".ogg"].includes(ext)) return 1;
  if (mime === "application/pdf" || ext === ".pdf") return 2;
  if ([".doc", ".docx", ".odt", ".pptx"].includes(ext)) return 3;
  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return 4;
  return 5;
}

const STORAGE_EXPANDED_KEY = "nihongo_drive_expanded_folders_v2";
const STORAGE_FOCUSED_KEY = "nihongo_drive_focused_folder_v2";

// ─── Sub-component: Memoized Node Row for high-performance rendering ─────────
interface DriveNodeRowProps {
  node: DriveNode;
  level: number;
  isFolder: boolean;
  expanded: boolean;
  isHighlighted: boolean;
  isFocused: boolean;
  isSelected: boolean;
  childrenNodes?: DriveNode[];
  searchTerm: string;
  onToggleExpand: (folderId: string, e: React.MouseEvent) => void;
  onFocusFolder: (folderId: string) => void;
  onOpenAutoSuggest: (folder: DriveNode) => void;
  onSelectNodeForAssignment?: (node: DriveNode) => void;
  onToggleSelect: (node: DriveNode, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, node: DriveNode) => void;
  isNodeVisible: (node: DriveNode) => boolean;
  isExpanded: (driveFileId: string) => boolean;
  isSelectedNode: (nodeId: string) => boolean;
  childNodesByParentDriveId: Record<string, DriveNode[]>;
}

const DriveNodeRow: React.FC<DriveNodeRowProps> = memo(({
  node,
  level,
  isFolder,
  expanded,
  isHighlighted,
  isFocused,
  isSelected,
  childrenNodes = [],
  searchTerm,
  onToggleExpand,
  onFocusFolder,
  onOpenAutoSuggest,
  onSelectNodeForAssignment,
  onToggleSelect,
  onDragStart,
  isNodeVisible,
  isExpanded,
  isSelectedNode,
  childNodesByParentDriveId,
}) => {
  const isFile = node.nodeType === 1;

  const getFileIcon = (n: DriveNode) => {
    if (n.nodeType === 0) return <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />;
    const mime = n.mimeType.toLowerCase();
    const ext = (n.fileExtension || "").toLowerCase();
    if (mime.startsWith("video/") || [".mp4", ".mkv", ".mov"].includes(ext))
      return <FileVideo className="w-4 h-4 text-indigo-400 shrink-0" />;
    if (mime.startsWith("audio/") || [".mp3", ".m4a", ".wav"].includes(ext))
      return <FileAudio className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (mime === "application/pdf" || ext === ".pdf")
      return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
    if (mime.startsWith("image/") || [".jpg", ".png", ".webp"].includes(ext))
      return <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />;
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-all text-xs group ${
          isFile ? "cursor-grab active:cursor-grabbing select-none" : "cursor-default select-none"
        } ${
          node.isDeletedInDrive
            ? "opacity-40 line-through"
            : isSelected
            ? "bg-indigo-50 dark:bg-indigo-950/60 ring-1.5 ring-indigo-500 border-indigo-200 dark:border-indigo-800 shadow-2xs"
            : isFocused
            ? "bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-400/30"
            : isHighlighted
            ? "bg-amber-50 dark:bg-amber-900/20"
            : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
        }`}
        style={{ paddingLeft: `${Math.max(level * 14 + 8, 8)}px` }}
        draggable={isFile}
        onDragStart={isFile ? (e) => onDragStart(e, node) : undefined}
        onClick={(e) => {
          if (isFile) {
            onToggleSelect(node, e);
          }
        }}
        title={
          isFile
            ? `Click (hoặc Ctrl/Shift+Click) để chọn nhiều file. Kéo sang bài học để gán hàng loạt.`
            : undefined
        }
      >
        {/* Left: chevron/checkbox + icon + name */}
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          {isFolder ? (
            <button
              type="button"
              className="text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 shrink-0 p-1 rounded-md transition-colors"
              tabIndex={-1}
              onClick={(e) => onToggleExpand(node.driveFileId, e)}
              aria-label={expanded ? "Thu gọn" : "Mở rộng"}
              title={expanded ? "Thu gọn" : "Mở rộng"}
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  expanded ? "rotate-90" : ""
                }`}
              />
            </button>
          ) : (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(node, e as any);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
            />
          )}

          {/* Folder/File icon + name: clicking sets focused folder */}
          <div
            className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 cursor-pointer"
            onClick={(e) => {
              if (isFolder) {
                onFocusFolder(node.driveFileId);
              }
            }}
          >
            {isFolder && expanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              getFileIcon(node)
            )}

            <span
              className={`truncate font-medium ${
                isSelected
                  ? "text-indigo-700 dark:text-indigo-300 font-bold"
                  : isFocused
                  ? "text-orange-700 dark:text-orange-300 font-bold"
                  : isHighlighted
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
              }`}
            >
              {node.name}
            </span>

            {node.size && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono ml-auto mr-2 shrink-0">
                {formatBytes(node.size)}
              </span>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenAutoSuggest(node);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold transition-colors"
              title="Auto-suggest lessons from child folders"
            >
              <Wand2 className="w-3 h-3" />
              Auto
            </button>
          )}

          {isFile && onSelectNodeForAssignment && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectNodeForAssignment(node);
              }}
              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-[10px] font-medium transition-colors"
            >
              + Assign
            </button>
          )}

          {node.webViewLink && (
            <a
              href={node.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
              title="Open in Drive"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Children (recursive) */}
      {isFolder && expanded && childrenNodes.length > 0 && (
        <div>
          {childrenNodes.map((child) => {
            const childIsFolder = child.nodeType === 0;
            const childExpanded = isExpanded(child.driveFileId);
            const childChildren = childIsFolder
              ? (childNodesByParentDriveId[child.driveFileId] || []).filter(isNodeVisible)
              : [];
            const childHighlighted = Boolean(searchTerm && child.name.toLowerCase().includes(searchTerm));
            const childFocused = false;
            const childSelected = isSelectedNode(child.id);

            return (
              <DriveNodeRow
                key={child.id}
                node={child}
                level={level + 1}
                isFolder={childIsFolder}
                expanded={childExpanded}
                isHighlighted={childHighlighted}
                isFocused={childFocused}
                isSelected={childSelected}
                childrenNodes={childChildren}
                searchTerm={searchTerm}
                onToggleExpand={onToggleExpand}
                onFocusFolder={onFocusFolder}
                onOpenAutoSuggest={onOpenAutoSuggest}
                onSelectNodeForAssignment={onSelectNodeForAssignment}
                onToggleSelect={onToggleSelect}
                onDragStart={onDragStart}
                isNodeVisible={isNodeVisible}
                isExpanded={isExpanded}
                isSelectedNode={isSelectedNode}
                childNodesByParentDriveId={childNodesByParentDriveId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

DriveNodeRow.displayName = "DriveNodeRow";

export const RawDriveTree: React.FC<RawDriveTreeProps> = ({
  nodes,
  onOpenAutoSuggest,
  onSelectNodeForAssignment,
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [focusedFolderId, setFocusedFolderId] = useState<string | null>(null);
  
  // ─── Multi-selection State ────────────────────────────────────────────────
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Load / Save persistent folder states
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedExp = sessionStorage.getItem(STORAGE_EXPANDED_KEY);
        if (savedExp) {
          const parsed = JSON.parse(savedExp);
          if (Array.isArray(parsed)) setExpandedFolders(new Set(parsed));
        }
        const savedFoc = sessionStorage.getItem(STORAGE_FOCUSED_KEY);
        if (savedFoc) {
          setFocusedFolderId(savedFoc);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && expandedFolders.size > 0) {
      try {
        sessionStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(Array.from(expandedFolders)));
      } catch {}
    }
  }, [expandedFolders]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (focusedFolderId) {
          sessionStorage.setItem(STORAGE_FOCUSED_KEY, focusedFolderId);
        } else {
          sessionStorage.removeItem(STORAGE_FOCUSED_KEY);
        }
      } catch {}
    }
  }, [focusedFolderId]);

  // Toggles expand/collapse — strictly isolated
  const toggleExpand = useCallback((folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allFolderIds = new Set<string>();
    nodes.forEach((n) => {
      if (n.nodeType === 0) allFolderIds.add(n.driveFileId);
    });
    setExpandedFolders(allFolderIds);
  }, [nodes]);

  const handleCollapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  // Build parent→children map
  const childNodesByParentDriveId = useMemo(() => {
    return nodes.reduce<Record<string, DriveNode[]>>((acc, node) => {
      if (node.parentDriveFileId) {
        if (!acc[node.parentDriveFileId]) acc[node.parentDriveFileId] = [];
        acc[node.parentDriveFileId].push(node);
      }
      return acc;
    }, {});
  }, [nodes]);

  // Set of all known drive file IDs
  const driveIdSet = useMemo(() => new Set(nodes.map((n) => n.driveFileId)), [nodes]);

  // Lookup map by ID for fast DnD payload generation
  const nodeById = useMemo(() => {
    const map = new Map<string, DriveNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Root nodes: nodes whose parent is not present in driveIdSet
  const rootNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    const roots = nodes.filter((n) => !n.parentDriveFileId || !driveIdSet.has(n.parentDriveFileId));
    if (roots.length > 0) return roots;

    // Fallback: minimum path depth
    const minDepth = Math.min(...nodes.map((n) => (n.rawPath || "").split("/").filter(Boolean).length));
    return nodes.filter((n) => (n.rawPath || "").split("/").filter(Boolean).length === minDepth);
  }, [nodes, driveIdSet]);

  // ─── Search: find matching nodes + their ancestor IDs ───────────────────
  const searchTerm = search.toLowerCase().trim();

  const getAncestorDriveIds = useCallback(
    (node: DriveNode): string[] => {
      const result: string[] = [];
      let current: DriveNode | undefined = node;
      while (current?.parentDriveFileId) {
        result.push(current.parentDriveFileId);
        current = nodes.find((n) => n.driveFileId === current!.parentDriveFileId);
      }
      return result;
    },
    [nodes]
  );

  // Compute expanded set when searching
  const searchExpandedIds = useMemo<Set<string>>(() => {
    if (!searchTerm) return new Set();
    const ids = new Set<string>();
    nodes.forEach((n) => {
      if (
        n.name.toLowerCase().includes(searchTerm) ||
        (n.rawPath && n.rawPath.toLowerCase().includes(searchTerm))
      ) {
        getAncestorDriveIds(n).forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [searchTerm, nodes, getAncestorDriveIds]);

  const isNodeVisible = useCallback((node: DriveNode): boolean => {
    if (!searchTerm) return true;
    if (node.name.toLowerCase().includes(searchTerm)) return true;
    if (node.rawPath && node.rawPath.toLowerCase().includes(searchTerm)) return true;
    // Folder: show if any descendant matches
    if (node.nodeType === 0) {
      const children = childNodesByParentDriveId[node.driveFileId] || [];
      return children.some(isNodeVisible);
    }
    return false;
  }, [searchTerm, childNodesByParentDriveId]);

  const isExpanded = useCallback((driveFileId: string) => {
    if (searchTerm) return searchExpandedIds.has(driveFileId);
    return expandedFolders.has(driveFileId);
  }, [searchTerm, searchExpandedIds, expandedFolders]);

  const isSelectedNode = useCallback((nodeId: string) => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  // Determine starting nodes to display based on focused folder / search / root
  const displayNodes = useMemo(() => {
    if (searchTerm) {
      return rootNodes.filter(isNodeVisible);
    }
    if (focusedFolderId) {
      const focusedNode = nodes.find((n) => n.driveFileId === focusedFolderId);
      if (focusedNode) {
        // Show siblings at root level for the parent of focused
        const parentId = focusedNode.parentDriveFileId;
        if (parentId && driveIdSet.has(parentId)) {
          return childNodesByParentDriveId[parentId] || [focusedNode];
        }
        // Focused node is at root level — show all root nodes
        return rootNodes;
      }
    }
    return rootNodes;
  }, [searchTerm, focusedFolderId, rootNodes, nodes, childNodesByParentDriveId, isNodeVisible, driveIdSet]);

  // ─── Flatten currently visible nodes in visual tree order for accurate Shift-click range ───
  const visibleFlatFileIds = useMemo<string[]>(() => {
    const list: string[] = [];
    const traverse = (nodeList: DriveNode[]) => {
      for (const n of nodeList) {
        if (!isNodeVisible(n)) continue;
        if (n.nodeType === 1) {
          list.push(n.id);
        } else if (n.nodeType === 0 && isExpanded(n.driveFileId)) {
          const children = childNodesByParentDriveId[n.driveFileId] || [];
          traverse(children);
        }
      }
    };
    traverse(displayNodes);
    return list;
  }, [displayNodes, isNodeVisible, isExpanded, childNodesByParentDriveId]);

  // ─── Multi-Selection Logic (Ctrl / Shift / Alt / Click) ───────────────────
  const handleToggleSelect = useCallback((node: DriveNode, e: React.MouseEvent) => {
    if (node.nodeType !== 1) return; // files only

    if (e.shiftKey && lastSelectedId) {
      // Range selection: Lấy toàn bộ các file từ vị trí trước đó đến vị trí hiện tại theo thứ tự đang hiển thị trên cây
      const startIdx = visibleFlatFileIds.indexOf(lastSelectedId);
      const endIdx = visibleFlatFileIds.indexOf(node.id);

      if (startIdx !== -1 && endIdx !== -1) {
        const low = Math.min(startIdx, endIdx);
        const high = Math.max(startIdx, endIdx);
        const range = visibleFlatFileIds.slice(low, high + 1);

        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          range.forEach((id) => next.add(id));
          return next;
        });
      } else {
        // Fallback nếu không tìm thấy trong visible flat
        setSelectedNodeIds((prev) => new Set(prev).add(node.id));
      }
    } else if (e.ctrlKey || e.metaKey || e.altKey) {
      // Toggle individual selection (Ctrl / Alt / Cmd)
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      setLastSelectedId(node.id);
    } else {
      // Click thường hoặc click Checkbox
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      setLastSelectedId(node.id);
    }
  }, [visibleFlatFileIds, lastSelectedId]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setLastSelectedId(null);
  }, []);

  // ─── Breadcrumb Navigation Trail ──────────────────────────────────────────
  const breadcrumbChain = useMemo<DriveNode[]>(() => {
    if (!focusedFolderId) return [];
    const chain: DriveNode[] = [];
    let curr: DriveNode | undefined = nodes.find((n) => n.driveFileId === focusedFolderId);
    while (curr) {
      chain.unshift(curr);
      curr = nodes.find((n) => n.driveFileId === curr!.parentDriveFileId);
    }
    return chain;
  }, [focusedFolderId, nodes]);

  // ─── Drag Start: Handles both Single File and Multi-Selected Batch ─────────
  const handleDragStart = useCallback((e: React.DragEvent, node: DriveNode) => {
    e.dataTransfer.effectAllowed = "copyMove";

    // If dragged node is part of the multi-selection, drag ALL selected files
    // If not selected, select it as single item
    let targetNodes: DriveNode[] = [];
    if (selectedNodeIds.has(node.id) && selectedNodeIds.size > 1) {
      targetNodes = Array.from(selectedNodeIds)
        .map((id) => nodeById.get(id))
        .filter((n): n is DriveNode => Boolean(n));
    } else {
      targetNodes = [node];
    }

    const items = targetNodes.map((n) => ({
      driveNodeId: n.id,
      driveFileId: n.driveFileId,
      name: n.name,
      mimeType: n.mimeType,
      fileExtension: n.fileExtension,
      resourceType: detectResourceType(n),
    }));

    const payload = {
      type: "drive-file",
      driveNodeId: node.id,
      driveFileId: node.driveFileId,
      name: node.name,
      mimeType: node.mimeType,
      fileExtension: node.fileExtension,
      resourceType: detectResourceType(node),
      items,
    };

    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData("application/json", jsonStr);
    e.dataTransfer.setData("text/plain", jsonStr);
  }, [selectedNodeIds, nodeById]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="shrink-0 p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">{t("rawDriveTree")}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExpandAll}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              title="Mở tất cả thư mục"
            >
              Mở hết
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              title="Thu gọn tất cả"
            >
              Thu gọn
            </button>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
              {nodes.length} nodes
            </span>
          </div>
        </div>

        {/* Selection Toolbar Banner if items selected */}
        {selectedNodeIds.size > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-300 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="font-bold">Đã chọn {selectedNodeIds.size} tệp</span>
              <span className="text-[10px] opacity-75">(Kéo bất kỳ tệp đã chọn để gán tất cả)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearSelection}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 shadow-2xs transition-colors"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        {/* Breadcrumb Navigation Trail */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-600 dark:text-slate-300 py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 font-medium scrollbar-none min-h-[28px]">
          <button
            onClick={() => setFocusedFolderId(null)}
            className={`flex items-center gap-1 hover:text-orange-500 transition-colors shrink-0 ${
              !focusedFolderId ? "font-bold text-orange-600 dark:text-orange-400" : ""
            }`}
          >
            <Home className="w-3 h-3 text-amber-500" />
            <span>Gốc (Drive)</span>
          </button>

          {breadcrumbChain.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ArrowRightIcon className="w-3 h-3 text-slate-400 shrink-0" />
              <button
                onClick={() => setFocusedFolderId(crumb.driveFileId)}
                className={`hover:text-orange-500 transition-colors truncate max-w-[120px] shrink-0 ${
                  crumb.driveFileId === focusedFolderId ? "font-bold text-orange-600 dark:text-orange-400" : ""
                }`}
                title={crumb.name}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchNodes")}
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Content — scrollable */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {nodes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            {t("noNodesFound")}
          </div>
        ) : displayNodes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Không tìm thấy thư mục/tệp nào phù hợp.
          </div>
        ) : (
          displayNodes.map((node) => {
            const isFolder = node.nodeType === 0;
            const expanded = isExpanded(node.driveFileId);
            const children = isFolder
              ? (childNodesByParentDriveId[node.driveFileId] || []).filter(isNodeVisible)
              : [];
            const isHighlighted = Boolean(searchTerm && node.name.toLowerCase().includes(searchTerm));
            const isFocused = focusedFolderId === node.driveFileId;
            const isSelected = isSelectedNode(node.id);

            return (
              <DriveNodeRow
                key={node.id}
                node={node}
                level={0}
                isFolder={isFolder}
                expanded={expanded}
                isHighlighted={isHighlighted}
                isFocused={isFocused}
                isSelected={isSelected}
                childrenNodes={children}
                searchTerm={searchTerm}
                onToggleExpand={toggleExpand}
                onFocusFolder={(id) => setFocusedFolderId(id)}
                onOpenAutoSuggest={onOpenAutoSuggest}
                onSelectNodeForAssignment={onSelectNodeForAssignment}
                onToggleSelect={handleToggleSelect}
                onDragStart={handleDragStart}
                isNodeVisible={isNodeVisible}
                isExpanded={isExpanded}
                isSelectedNode={isSelectedNode}
                childNodesByParentDriveId={childNodesByParentDriveId}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

