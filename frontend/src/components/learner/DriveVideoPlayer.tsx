"use client";

import React, { useState, useEffect, useRef } from "react";
import { Video, ExternalLink, Info, Tv, Maximize2, Minimize2, X, BookmarkCheck } from "lucide-react";
import { api } from "@/lib/api";

interface DriveVideoPlayerProps {
  driveFileId?: string;
  title: string;
  customUrl?: string;
  lessonId?: string;
}

export const DriveVideoPlayer: React.FC<DriveVideoPlayerProps> = ({ driveFileId, title, customUrl, lessonId }) => {
  const [showSignInBanner, setShowSignInBanner] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [savedPositionSecs, setSavedPositionSecs] = useState<number>(0);
  const [totalDurationSecs, setTotalDurationSecs] = useState<number>(0);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Elapsed seconds accumulator — Drive iframe can't expose currentTime
  const elapsedRef = useRef<number>(0);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Reset and load saved position whenever lessonId changes
  useEffect(() => {
    elapsedRef.current = 0;
    setSavedPositionSecs(0);
    setTotalDurationSecs(0);
    setShowResumeModal(false);
    setResumeToast(null);
    if (!lessonId) return;

    api.getLessonProgress(lessonId).then((prog) => {
      if (prog && prog.lastPlaybackPositionSeconds && prog.lastPlaybackPositionSeconds > 2) {
        const saved = prog.lastPlaybackPositionSeconds;
        const total = prog.totalDurationSeconds ?? 0;
        setSavedPositionSecs(saved);
        setTotalDurationSecs(total);
        // Pre-seed accumulator so we continue from saved position
        elapsedRef.current = saved;
        setShowResumeModal(true);
        setResumeToast(`Tiếp tục từ ${formatTime(saved)}`);
        setTimeout(() => setResumeToast(null), 8000);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // Periodic save of playback position (every 5 seconds)
  useEffect(() => {
    if (!lessonId) return;

    // Tick increment
    const tickInterval = setInterval(() => {
      elapsedRef.current += 1;
    }, 1000);

    // Persist position every 5 seconds using live accumulator
    saveIntervalRef.current = setInterval(() => {
      const pos = elapsedRef.current;
      if (pos <= 0) return;
      api.savePlaybackPosition({
        lessonId,
        positionSeconds: pos,
        durationSeconds: totalDurationSecs,
      }).catch(() => {
        // Silent fail — don't interrupt user
      });
    }, 5000);

    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      clearInterval(tickInterval);
    };
  }, [lessonId, totalDurationSecs]);

  if (!driveFileId && !customUrl) {
    return (
      <div className="w-full aspect-video rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 gap-3 p-6 shadow-inner">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
          <Video className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-center text-slate-400">Chưa gắn tài nguyên video bài giảng cho bài học này.</p>
      </div>
    );
  }

  const iframeSrc = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : customUrl;

  return (
    <>
      {/* Resume Modal - Show when saved position exists */}
      {showResumeModal && savedPositionSecs > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border-2 border-emerald-500/30 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <BookmarkCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Tiếp Tục Xem Video?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bạn đã xem video này trước đó</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Vị trí đã lưu:</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatTime(savedPositionSecs)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                  style={{
                    width: totalDurationSecs > 0
                      ? `${Math.min(100, Math.round((savedPositionSecs / totalDurationSecs) * 100))}%`
                      : "35%",
                  }}
                />
              </div>
              {totalDurationSecs > 0 && (
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  {Math.min(100, Math.round((savedPositionSecs / totalDurationSecs) * 100))}% hoàn thành
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              💡 <span className="font-semibold">Lưu ý:</span> Do giới hạn kỹ thuật của Google Drive iframe, bạn cần tự kéo thanh timeline video đến phút <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatTime(savedPositionSecs)}</span> để tiếp tục xem.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  elapsedRef.current = 0;
                  setSavedPositionSecs(0);
                  setShowResumeModal(false);
                  setResumeToast(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors"
              >
                Xem Lại Từ Đầu
              </button>
              <button
                onClick={() => setShowResumeModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-extrabold shadow-lg transition-all active:scale-95"
              >
                Tiếp Tục Xem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theater Mode Fixed Modal Container */}
      {isTheaterMode && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex flex-col animate-in fade-in duration-200">
          {/* Header toolbar */}
          <div className="flex items-center justify-between p-4 bg-slate-900/80 border-b border-slate-800 text-white">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white font-extrabold text-[10px] uppercase">
                Rạp Chiếu • Theater Mode
              </span>
              <h2 className="font-extrabold text-sm truncate max-w-md">{title}</h2>
            </div>

            <div className="flex items-center gap-3">
              {driveFileId && (
                <a
                  href={`https://drive.google.com/file/d/${driveFileId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Google Drive
                </a>
              )}
              <button
                onClick={() => setIsTheaterMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold transition-all"
              >
                <Minimize2 className="w-4 h-4" /> Thoát Rạp Chiếu
              </button>
            </div>
          </div>

          {/* Full Screen Viewport Video */}
          <div className="flex-1 w-full h-full p-4 flex items-center justify-center">
            <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
              <iframe
                src={iframeSrc}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={title}
              />
            </div>
          </div>
        </div>
      )}

      {/* Standard In-Page Player */}
      <div className="flex flex-col gap-3">
        {/* Video Control Top Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-orange-500" />
              <span>Trình Phát Bài Giảng HD (Drive Player)</span>
            </span>
            {resumeToast && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 animate-pulse">
                <BookmarkCheck className="w-3.5 h-3.5" />
                {resumeToast}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTheaterMode(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs font-extrabold transition-all"
              title="Mở rộng không gian xem video Rạp chiếu"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Bật Rạp Chiếu (Theater)</span>
            </button>

            {driveFileId && (
              <a
                href={`https://drive.google.com/file/d/${driveFileId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-orange-500 transition-colors"
                title="Mở tab mới trên Google Drive"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* 16:9 Video Container */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl group">
          <iframe
            src={iframeSrc}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>

        {/* Account Identity Reminder Banner */}
        {showSignInBanner && driveFileId && (
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lưu ý quyền xem Google Drive:</span> Trình phát video sử dụng iframe chính chủ Google. Hãy đảm bảo trình duyệt của bạn đã đăng nhập tài khoản Google có quyền truy cập thư mục khóa học này.
              </div>
            </div>
            <button
              onClick={() => setShowSignInBanner(false)}
              className="text-amber-500 hover:text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px]"
            >
              Đã hiểu
            </button>
          </div>
        )}
      </div>
    </>
  );
};
