"use client";

import React, { useState, useCallback, useMemo } from "react";
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

export const RawDriveTree: React.FC<RawDriveTreeProps> = ({
  nodes,
  onOpenAutoSuggest,
  onSelectNodeForAssignment,
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [focusedFolderId, setFocusedFolderId] = useState<string | null>(null);

  // Toggles expand/collapse — strictly isolated, never affects focusedFolderId
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

  const getFileIcon = (node: DriveNode) => {
    if (node.nodeType === 0) return <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />;
    const mime = node.mimeType.toLowerCase();
    const ext = (node.fileExtension || "").toLowerCase();
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
        n.rawPath.toLowerCase().includes(searchTerm)
      ) {
        getAncestorDriveIds(n).forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [searchTerm, nodes, getAncestorDriveIds]);

  const isNodeVisible = useCallback((node: DriveNode): boolean => {
    if (!searchTerm) return true;
    if (node.name.toLowerCase().includes(searchTerm)) return true;
    if (node.rawPath.toLowerCase().includes(searchTerm)) return true;
    // Folder: show if any descendant matches
    if (node.nodeType === 0) {
      const children = childNodesByParentDriveId[node.driveFileId] || [];
      return children.some(isNodeVisible);
    }
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, childNodesByParentDriveId]);

  const isExpanded = useCallback((driveFileId: string) => {
    if (searchTerm) return searchExpandedIds.has(driveFileId);
    return expandedFolders.has(driveFileId);
  }, [searchTerm, searchExpandedIds, expandedFolders]);

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

  // ─── Drag Start ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, node: DriveNode) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        driveNodeId: node.id,
        driveFileId: node.driveFileId,
        name: node.name,
        mimeType: node.mimeType,
        fileExtension: node.fileExtension,
        resourceType: detectResourceType(node),
      })
    );
  };

  const renderNode = (node: DriveNode, level = 0) => {
    if (!isNodeVisible(node)) return null;
    const isFolder = node.nodeType === 0;
    const expanded = isExpanded(node.driveFileId);
    const children = (childNodesByParentDriveId[node.driveFileId] || []).filter(isNodeVisible);
    const isFile = node.nodeType === 1;
    const isHighlighted = searchTerm && node.name.toLowerCase().includes(searchTerm);
    const isFocused = focusedFolderId === node.driveFileId;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-xs group cursor-default ${
            node.isDeletedInDrive
              ? "opacity-40 line-through"
              : isFocused
              ? "bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-400/30"
              : isHighlighted
              ? "bg-amber-50 dark:bg-amber-900/20"
              : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
          }`}
          style={{ paddingLeft: `${Math.max(level * 14 + 8, 8)}px` }}
          draggable={isFile}
          onDragStart={isFile ? (e) => handleDragStart(e, node) : undefined}
        >
          {/* Left: chevron + icon + name */}
          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            {/* Chevron: ONLY toggles expand — stopPropagation prevents row selection */}
            {isFolder ? (
              <button
                type="button"
                className="text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 shrink-0 p-1 rounded-md transition-colors"
                tabIndex={-1}
                onClick={(e) => toggleExpand(node.driveFileId, e)}
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
              <span className="w-3.5 h-3.5 shrink-0" />
            )}

            {/* Folder/File icon + name: clicking sets focused folder */}
            <div
              className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 cursor-pointer"
              onClick={() => {
                if (isFolder) {
                  setFocusedFolderId(node.driveFileId);
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
                  isFocused
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
        {isFolder && expanded && children.length > 0 && (
          <div>{children.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">{t("rawDriveTree")}</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
            {nodes.length} nodes
          </span>
        </div>

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
          displayNodes.map((n) => renderNode(n, 0))
        )}
      </div>
    </div>
  );
};
