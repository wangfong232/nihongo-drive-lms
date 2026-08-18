"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Headphones,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface DriveAudioPlayerProps {
  src?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
}

export function extractDriveFileId(url?: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // If it's already a raw Drive File ID (25-50 chars)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  // Format: /file/d/FILE_ID/...
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Format: ?id=FILE_ID or &id=FILE_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  return null;
}

export const DriveAudioPlayer: React.FC<DriveAudioPlayerProps> = ({
  src,
  title,
  className = "",
  autoPlay = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const driveId = extractDriveFileId(src);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5222/api";
  let audioStreamUrl = "";
  if (driveId) {
    audioStreamUrl = `${API_BASE}/audio/proxy-drive?driveFileId=${driveId}`;
  } else if (src) {
    audioStreamUrl = src;
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    setUseIframeFallback(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
  }, [src, audioStreamUrl]);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!audioStreamUrl) return;

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

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
              if (driveId) setUseIframeFallback(true);
            }
          });
      }
    };

    attemptPlay(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = val;
      } catch {}
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!src) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-400 flex items-center gap-2 ${className}`}>
        <Volume2 className="w-4 h-4 text-slate-400" />
        <span>Chưa có tệp âm thanh nghe hiểu.</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md ${className}`}>
      {/* Hidden HTML5 Audio Element */}
      {audioStreamUrl && (
        <audio
          ref={audioRef}
          src={audioStreamUrl}
          autoPlay={autoPlay}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime || 0);
              if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                setDuration(audioRef.current.duration);
              }
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 0);
              setIsLoading(false);
              setHasError(false);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          preload="none"
          onError={(e) => {
            const err = e.currentTarget.error;
            if (err && err.code === 1) return;
            setIsLoading(false);
            setIsPlaying(false);
            setHasError(true);
          }}
        />
      )}

      {/* Title & Info Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {title || "Audio Nghe Hiểu (Choukai)"}
            </h4>
            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider">
              {driveId ? "Google Drive Audio" : "Direct Audio"}
            </span>
          </div>
        </div>

        {driveId && (
          <a
            href={`https://drive.google.com/file/d/${driveId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline shrink-0"
          >
            <span>Mở Drive</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Audio Player Controls */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-inner">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-orange-500/20 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Progress Slider */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
          />
          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>

          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Fallback Iframe if Direct Stream encounters browser policy */}
      {useIframeFallback && driveId && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Đang mở trình phát Google Drive dự phòng:
            </span>
            <button
              onClick={() => {
                setUseIframeFallback(false);
                setHasError(false);
                if (audioRef.current) {
                  audioRef.current.load();
                }
              }}
              className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-700"
            >
              Thử lại phát trực tiếp
            </button>
          </div>
          <div className="w-full h-20 sm:h-24 rounded-xl overflow-hidden bg-slate-900 border border-orange-500/20 shadow-inner">
            <iframe
              src={`https://drive.google.com/file/d/${driveId}/preview`}
              className="w-full h-full border-0"
              allow="autoplay"
              title={title || "Drive Audio Fallback"}
            />
          </div>
        </div>
      )}

      {hasError && !driveId && (
        <div className="text-[11px] text-rose-500 flex items-center gap-1.5 font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Không thể tải luồng âm thanh. Vui lòng kiểm tra lại đường dẫn tệp.</span>
        </div>
      )}
    </div>
  );
};
