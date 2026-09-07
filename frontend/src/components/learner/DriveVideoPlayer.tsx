"use client";

import React, { useState, useEffect, useRef } from "react";
import { Video, ExternalLink, Info, Tv, Maximize2, Minimize2, X, BookmarkCheck, EyeOff, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useUserSettings } from "@/lib/userSettings";

interface DriveVideoPlayerProps {
  driveFileId?: string;
  title: string;
  customUrl?: string;
  lessonId?: string;
  resourceId?: string;
  isCompleted?: boolean;
  onToggleComplete?: () => void;
  onVideoEnded?: () => void;
}

export const DriveVideoPlayer: React.FC<DriveVideoPlayerProps> = ({
  driveFileId,
  title,
  customUrl,
  lessonId,
  resourceId,
  isCompleted,
  onToggleComplete,
  onVideoEnded,
}) => {
  const { settings, isLoaded, toggleTrackVideoWatchTime } = useUserSettings();
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

  // Reset and load saved position whenever lessonId changes (only if tracking & resume prompt are enabled)
  useEffect(() => {
    elapsedRef.current = 0;
    setSavedPositionSecs(0);
    setTotalDurationSecs(0);
    setShowResumeModal(false);
    setResumeToast(null);
    if (!lessonId || !settings.trackVideoWatchTime || !settings.showResumePrompt) return;

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
  }, [lessonId, settings.trackVideoWatchTime, settings.showResumePrompt, isLoaded]);

  // If tracking is disabled, immediately dismiss any active modal/toast
  useEffect(() => {
    if (!settings.trackVideoWatchTime || !settings.showResumePrompt) {
      setShowResumeModal(false);
      setResumeToast(null);
    }
  }, [settings.trackVideoWatchTime, settings.showResumePrompt]);

  // Periodic save of playback position (every 5 seconds) - only if tracking is enabled
  useEffect(() => {
    if (!lessonId || !settings.trackVideoWatchTime) return;

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
  }, [lessonId, totalDurationSecs, settings.trackVideoWatchTime]);

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
      {/* Resume Modal - Show only when tracking is enabled and saved position exists */}
      {showResumeModal && settings.trackVideoWatchTime && settings.showResumePrompt && savedPositionSecs > 0 && (
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
              {/* Theater Tracking Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = toggleTrackVideoWatchTime();
                  if (!next) {
                    setShowResumeModal(false);
                    setResumeToast(null);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  settings.trackVideoWatchTime
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
                title={
                  settings.trackVideoWatchTime
                    ? "Đang bật tự động theo dõi số phút đã xem. Bấm để TẮT."
                    : "Đã tắt theo dõi số phút đã xem video. Bấm để BẬT lại."
                }
              >
                {settings.trackVideoWatchTime ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>Theo dõi: BẬT</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Theo dõi: ĐÃ TẮT</span>
                  </>
                )}
              </button>

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
      <div className="flex flex-col gap-2">
        {/* Video Control Top Bar */}
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-xs">
              <Tv className="w-3.5 h-3.5 text-[#f97316]" />
              <span>Drive Player HD</span>
            </span>
            {resumeToast && settings.showResumePrompt && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30 animate-pulse">
                <BookmarkCheck className="w-3 h-3" />
                {resumeToast}
              </span>
            )}
            {/* Quick Toggle Watch Time Switch */}
            <button
              type="button"
              onClick={() => {
                const next = toggleTrackVideoWatchTime();
                if (!next) {
                  setShowResumeModal(false);
                  setResumeToast(null);
                }
              }}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer ${
                settings.trackVideoWatchTime
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700"
              }`}
              title={
                settings.trackVideoWatchTime
                  ? "Đang bật tự động theo dõi số phút đã xem. Bấm để TẮT."
                  : "Đã tắt theo dõi số phút đã xem video. Bấm để BẬT lại."
              }
            >
              {settings.trackVideoWatchTime ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>Theo dõi: BẬT</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Theo dõi: TẮT</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onToggleComplete && (
              <button
                type="button"
                onClick={onToggleComplete}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer ${
                  isCompleted
                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
                title="Đánh dấu đã xem xong video này"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${isCompleted ? "text-emerald-500" : "text-slate-400"}`} />
                <span>{isCompleted ? "Đã xong ✓" : "Xong video này"}</span>
              </button>
            )}

            <button
              onClick={() => setIsTheaterMode(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs font-extrabold transition-all cursor-pointer"
              title="Mở rộng không gian xem video Rạp chiếu"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Rạp Chiếu</span>
            </button>

            {driveFileId && (
              <a
                href={`https://drive.google.com/file/d/${driveFileId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-orange-500 transition-colors"
                title="Mở tab mới trên Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* 16:9 Video Container with smart max-height to fit within viewport */}
        <div className="relative w-full aspect-video max-h-[calc(100vh-210px)] rounded-2xl overflow-hidden bg-black border border-slate-800/80 shadow-lg group mx-auto">
          <iframe
            src={iframeSrc}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
      </div>
    </>
  );
};
