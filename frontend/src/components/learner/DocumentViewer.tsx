"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  ExternalLink,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  Download,
  X,
} from "lucide-react";

interface DocumentViewerProps {
  title: string;
  driveFileId?: string;
  customUrl?: string;
  resourceType?: number; // 2: PDF, 3: Docx, 4: Image, 5: Other
  lessonId?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  title,
  driveFileId,
  customUrl,
  resourceType = 2,
}) => {
  const [isTheater, setIsTheater] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to exit theater mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTheater) {
        setIsTheater(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTheater]);

  if (!driveFileId && !customUrl) {
    return (
      <div className="w-full h-96 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 gap-3 p-6 shadow-inner">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
          <FileText className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-center text-slate-400">
          Chưa có tệp tài liệu cho bài học này.
        </p>
      </div>
    );
  }

  const iframeSrc = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : customUrl;

  const externalLink = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/view`
    : customUrl;

  const getDocTypeBadge = () => {
    switch (resourceType) {
      case 2:
        return { label: "Tài Liệu PDF", color: "bg-rose-500/10 text-rose-500 border-rose-500/30" };
      case 3:
        return { label: "Word / Office", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30" };
      case 4:
        return { label: "Hình Ảnh", color: "bg-amber-500/10 text-amber-500 border-amber-500/30" };
      default:
        return { label: "Tài Liệu Đọc", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" };
    }
  };

  const badge = getDocTypeBadge();

  return (
    <>
      {/* Standard In-Page Viewer */}
      <div
        ref={containerRef}
        className="relative w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl flex flex-col h-[780px] sm:h-[860px] min-h-[680px]"
      >
        {/* Top Controls Bar */}
        <div className="p-3 px-4 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                {title}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline font-medium">
                  Xem trực tiếp chất lượng cao
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {externalLink && (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs"
                title="Mở tài liệu trong tab mới trên Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở Tab Mới</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setIsTheater(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm shadow-orange-500/20"
              title="Phóng to toàn màn hình"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Toàn Màn Hình</span>
            </button>
          </div>
        </div>

        {/* Embedded Document Frame */}
        <div className="relative flex-1 w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
              <div className="flex items-center gap-2.5 text-xs text-slate-300 font-bold">
                <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                <span>Đang tải xem trước tài liệu...</span>
              </div>
            </div>
          )}

          <iframe
            src={iframeSrc}
            title={title}
            className="w-full h-full border-0 rounded-b-3xl"
            allow="autoplay; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>

      {/* Fullscreen Portal Mode (Rendered at Body Level to avoid CSS transform skewing) */}
      {mounted &&
        isTheater &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 flex flex-col animate-in fade-in duration-150 select-none">
            {/* Fullscreen Top Header */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 text-white shrink-0 shadow-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="text-sm font-extrabold text-white truncate max-w-lg">
                    {title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Chế độ xem tài liệu toàn màn hình (Bấm ESC hoặc Thu Nhỏ để thoát)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {externalLink && (
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
                    title="Mở tài liệu trong tab mới trên Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Tab Mới</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setIsTheater(false)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold transition-all active:scale-95 shadow-md shadow-orange-500/30"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Thu Nhỏ (ESC)</span>
                </button>
              </div>
            </div>

            {/* Fullscreen Iframe Canvas */}
            <div className="flex-1 w-full h-full bg-slate-900 relative">
              <iframe
                src={iframeSrc}
                title={title}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
