"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  FastForward,
  Rewind,
  FileAudio,
  ExternalLink,
  BookmarkCheck,
  Headphones,
  Repeat,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { extractDriveFileId } from "@/components/common/DriveAudioPlayer";
import { playJapaneseSpeech } from "@/lib/tts";

interface AudioPlayerProps {
  title: string;
  driveFileId?: string;
  audioUrl?: string;
  lessonId?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  title,
  driveFileId,
  audioUrl,
  lessonId,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const lastSavedTimeRef = useRef<number>(0);
  const pendingResumeRef = useRef<number>(0);

  // Auto-detect drive file ID from audioUrl if not passed explicitly
  const effectiveDriveId = driveFileId || extractDriveFileId(audioUrl);
  
  // Direct stream URL (hit backend API directly with CORS support for optimal Range-header byte streaming)
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5222/api";
  let streamUrl = "";
  if (effectiveDriveId) {
    streamUrl = `${API_BASE}/audio/proxy-drive?driveFileId=${effectiveDriveId}`;
  } else if (audioUrl && audioUrl.trim().length > 0) {
    streamUrl = audioUrl.trim();
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Load saved position from API
  useEffect(() => {
    if (!lessonId) return;
    pendingResumeRef.current = 0;
    api.getLessonProgress(lessonId).then((prog) => {
      if (prog && prog.lastPlaybackPositionSeconds && prog.lastPlaybackPositionSeconds > 2) {
        const savedPos = prog.lastPlaybackPositionSeconds;
        pendingResumeRef.current = savedPos;
        const formatted = formatTime(savedPos);
        setResumeToast(`Tiếp tục từ ${formatted}`);
        setTimeout(() => setResumeToast(null), 4000);
        if (audioRef.current && audioRef.current.readyState >= 1) {
          try {
            audioRef.current.currentTime = savedPos;
            setCurrentTime(savedPos);
          } catch {}
          pendingResumeRef.current = 0;
        }
      }
    });
  }, [lessonId]);

  // Reset states on URL change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    setIsLoading(false);
    setUseIframeFallback(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
  }, [streamUrl]);

  // Save playback position (debounced)
  const savePosition = (pos: number, dur: number) => {
    if (!lessonId || pos <= 0) return;
    if (Math.abs(pos - lastSavedTimeRef.current) >= 3) {
      lastSavedTimeRef.current = pos;
      api.savePlaybackPosition({ lessonId, positionSeconds: pos, durationSeconds: dur });
    }
  };

  const togglePlay = () => {
    if (!streamUrl) {
      playJapaneseSpeech(title);
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    // If audio was not loaded or previously errored, reload first
    if (audioRef.current.readyState === 0 || hasError) {
      try {
        audioRef.current.load();
      } catch {}
    }

    const attemptPlay = (retryCount = 0) => {
      if (!audioRef.current) return;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            setHasError(false);
          })
          .catch((err) => {
            if (err?.name === "AbortError") {
              setIsLoading(false);
              return;
            }
            if (retryCount < 2) {
              // Retry once after 800ms in case backend is caching the file
              setTimeout(() => {
                if (audioRef.current) {
                  try { audioRef.current.load(); } catch {}
                  attemptPlay(retryCount + 1);
                }
              }, 800);
            } else {
              setIsLoading(false);
              setIsPlaying(false);
              setHasError(true);
              if (effectiveDriveId) {
                setUseIframeFallback(true);
              }
            }
          });
      }
    };

    attemptPlay(0);
  };

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return;
    try {
      const newTime = Math.min(Math.max(0, audioRef.current.currentTime + seconds), duration || 9999);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      savePosition(newTime, duration);
    } catch {}
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime || 0;
      const dur = audioRef.current.duration || duration || 0;
      setCurrentTime(cur);
      if (dur > 0 && duration === 0) setDuration(dur);
      savePosition(cur, dur);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration || 0;
      setDuration(dur);
      setIsLoading(false);
      setHasError(false);
      if (pendingResumeRef.current > 2) {
        try {
          audioRef.current.currentTime = pendingResumeRef.current;
          setCurrentTime(pendingResumeRef.current);
        } catch {}
        pendingResumeRef.current = 0;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = val;
      } catch {}
      savePosition(val, duration);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="w-full shrink-0 min-h-[220px] relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/80 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 p-5 sm:p-7 shadow-xl flex flex-col gap-5 block">
      {/* Hidden Native Audio Element */}
      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={handleLoadedMetadata}
          onError={(e) => {
            const err = e.currentTarget.error;
            if (err && err.code === 1) {
              return;
            }
            setIsLoading(false);
            setIsPlaying(false);
            setHasError(true);
            if (effectiveDriveId) {
              setUseIframeFallback(true);
            }
          }}
          preload="none"
        />
      )}

      {/* Top Track Info Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Headphones className="w-6 h-6" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-500/20">
                Luyện Nghe • Chōkai
              </span>
              {resumeToast && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 animate-pulse">
                  <BookmarkCheck className="w-3 h-3" /> {resumeToast}
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate mt-1">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {effectiveDriveId && (
            <button
              onClick={() => {
                setUseIframeFallback(!useIframeFallback);
                if (useIframeFallback) {
                  setHasError(false);
                  if (audioRef.current) audioRef.current.load();
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shadow-2xs ${
                useIframeFallback
                  ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              }`}
              title="Chuyển đổi giữa trình phát Google Drive và Trình phát Native"
            >
              {useIframeFallback ? "📁 Trình phát Drive (Bật)" : "📁 Phát bằng Drive"}
            </button>
          )}

          {effectiveDriveId && (
            <a
              href={`https://drive.google.com/file/d/${effectiveDriveId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs shrink-0"
              title="Mở tệp âm thanh trên Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Drive Link</span>
            </a>
          )}
        </div>
      </div>

      {/* Embedded Google Drive Player */}
      {useIframeFallback && effectiveDriveId && (
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Trình phát Google Drive (Tích hợp tài khoản Google trên trình duyệt):</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setUseIframeFallback(false);
                  setHasError(false);
                  if (audioRef.current) {
                    audioRef.current.load();
                    togglePlay();
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold text-[10px] border border-slate-200 dark:border-slate-700"
              >
                Thử lại phát trực tiếp
              </button>
            </div>
          </div>
          <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-950 border border-emerald-500/30 shadow-inner">
            <iframe
              src={`https://drive.google.com/file/d/${effectiveDriveId}/preview`}
              className="w-full h-full border-0"
              allow="autoplay"
              title={title}
            />
          </div>
        </div>
      )}

      {/* Error notice with Drive Fallback options */}
      {hasError && !useIframeFallback && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-medium flex-wrap">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Tệp âm thanh chưa thể phát trực tiếp từ máy chủ.</span>
          </div>
          <div className="flex items-center gap-2">
            {effectiveDriveId && (
              <button
                onClick={() => setUseIframeFallback(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0 shadow-xs transition-colors"
              >
                Mở Trình Phát Google Drive
              </button>
            )}
            <button
              onClick={() => playJapaneseSpeech(title)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shrink-0 shadow-xs transition-colors"
            >
              Phát bằng TTS
            </button>
          </div>
        </div>
      )}

      {/* Animated Equalizer Wave Visualizer */}
      <div className="h-8 flex items-center justify-center gap-1 sm:gap-1.5 px-4 bg-slate-100/60 dark:bg-slate-950/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
        {[40, 70, 25, 90, 50, 80, 30, 60, 95, 45, 75, 35, 85, 65, 30, 55, 90, 40, 70, 50, 80, 20, 60, 85].map(
          (h, i) => (
            <div
              key={i}
              className={`w-1 sm:w-1.5 rounded-full transition-all duration-200 ${
                isPlaying
                  ? "bg-gradient-to-t from-emerald-500 to-teal-400"
                  : "bg-slate-300 dark:bg-slate-700"
              }`}
              style={{
                height: isPlaying ? `${Math.max(15, (h * (Math.sin(currentTime * 4 + i) + 1.2)) / 2)}%` : "20%",
                opacity: isPlaying ? 0.9 : 0.4,
              }}
            />
          )
        )}
      </div>

      {/* Seek Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="relative w-full flex items-center group cursor-pointer">
          {/* Track background */}
          <div className="w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden relative shadow-inner">
            {/* Filled Progress */}
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400 rounded-full transition-all duration-75 relative"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex justify-between items-center text-[11px] font-mono font-bold text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Modern Player Controls Bar */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/70 dark:border-slate-800/80 flex-wrap">
        {/* Left Side: Playback Speed & Loop */}
        <div className="flex items-center gap-1.5">
          {/* Speed Selector */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
            {[0.75, 1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  playbackSpeed === spd
                    ? "bg-emerald-600 text-white shadow-xs scale-105"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Loop Toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-xl text-xs font-bold transition-all border ${
              isLooping
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40"
                : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
            title={isLooping ? "Tắt lặp lại" : "Bật lặp lại toàn bài"}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Rewind 5s, Main Play/Pause, Fast Forward 5s */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Rewind 5s */}
          <button
            onClick={() => skipSeconds(-5)}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-transform active:scale-90 flex items-center justify-center"
            title="Tua lại 5 giây"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Main Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-75"
            title={isPlaying ? "Tạm dừng" : "Phát bài học"}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white ml-0.5" />
            )}
          </button>

          {/* Fast Forward 5s */}
          <button
            onClick={() => skipSeconds(5)}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-transform active:scale-90 flex items-center justify-center"
            title="Tua tới 5 giây"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side: Volume & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => skipSeconds(-currentTime)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 text-xs font-bold"
            title="Phát lại từ đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-lg cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
