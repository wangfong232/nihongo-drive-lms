"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Pencil,
  Eye,
  SkipForward,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Gauge,
  HelpCircle,
  Flame,
  Volume2,
} from "lucide-react";

interface KanjiCanvasProps {
  kanji: string;
  size?: number;
  className?: string;
  hanViet?: string;
  meaning?: string;
}

type SpeedMultiplier = 0.5 | 1 | 2;

interface HanziCharData {
  strokes?: string[];
  radStrokes?: number[];
}

interface HanziStrokeData {
  strokeNum: number;
  mistakesOnStroke: number;
  totalMistakes: number;
  strokesRemaining: number;
}

interface HanziSummaryData {
  totalMistakes: number;
}

interface HanziWriterInstance {
  animateCharacter: (options?: { strokeAnimationSpeed?: number; onComplete?: () => void }) => void;
  animateStroke: (strokeNum: number, options?: { strokeAnimationSpeed?: number; onComplete?: () => void }) => void;
  pauseAnimation: () => void;
  showCharacter: () => void;
  hideCharacter: () => void;
  showOutline: () => void;
  hideOutline: () => void;
  cancelQuiz: () => void;
  quiz: (options?: {
    showOutline?: boolean;
    onCorrectStroke?: (data: HanziStrokeData) => void;
    onMistake?: (data: HanziStrokeData) => void;
    onComplete?: (summary: HanziSummaryData) => void;
  }) => void;
}

export const KanjiCanvas: React.FC<KanjiCanvasProps> = ({
  kanji,
  size = 280,
  className = "",
  hanViet,
  meaning,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriterInstance | null>(null);

  // States
  const [mode, setMode] = useState<"view" | "quiz">("view");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);
  const [showOutline, setShowOutline] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const [currentStroke, setCurrentStroke] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Initialize or reload HanziWriter when kanji or size changes
  useEffect(() => {
    if (!containerRef.current || !kanji) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(false);
    setQuizCompleted(false);
    setMistakes(0);
    setCurrentStroke(0);
    setIsPlaying(false);

    // Clear previous DOM contents
    containerRef.current.innerHTML = "";

    const initWriter = async () => {
      try {
        const HanziWriterModule = (await import("hanzi-writer")).default;
        if (!isMounted || !containerRef.current) return;

        const writer = HanziWriterModule.create(containerRef.current, kanji, {
          width: size,
          height: size,
          padding: 18,
          showOutline: showOutline,
          strokeAnimationSpeed: speed,
          delayBetweenStrokes: 150,
          strokeColor: "#ea580c", // Vibrant bold orange
          radicalColor: "#f43f5e", // Rose for radical
          outlineColor: "rgba(148, 163, 184, 0.35)", // Clean ghost guide
          drawingColor: "#0284c7", // Bright blue for user drawing
          drawingWidth: 14,
          showHintAfterMisses: 1,
          highlightOnComplete: true,
          highlightColor: "#10b981", // Emerald on complete
          onLoadCharDataSuccess: (data: HanziCharData) => {
            if (!isMounted) return;
            setLoading(false);
            setStrokeCount(data?.strokes?.length || 0);
          },
          onLoadCharDataError: () => {
            if (!isMounted) return;
            setLoading(false);
            setLoadError(true);
          },
        }) as unknown as HanziWriterInstance;

        writerRef.current = writer;

        // If mode is already quiz, start quiz immediately
        if (mode === "quiz") {
          startQuizMode(writer);
        }
      } catch (e) {
        if (!isMounted) return;
        setLoading(false);
        setLoadError(true);
      }
    };

    initWriter();

    return () => {
      isMounted = false;
      if (writerRef.current) {
        try {
          writerRef.current.cancelQuiz();
        } catch {}
      }
    };
  }, [kanji, size]);

  // Handle outline visibility toggle
  const toggleOutline = () => {
    const next = !showOutline;
    setShowOutline(next);
    if (writerRef.current) {
      try {
        if (next) {
          writerRef.current.showOutline();
        } else {
          writerRef.current.hideOutline();
        }
      } catch {}
    }
  };

  // ─── Animation Controls ───────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!writerRef.current) return;
    setIsPlaying(true);
    try {
      writerRef.current.animateCharacter({
        strokeAnimationSpeed: speed,
        onComplete: () => {
          setIsPlaying(false);
        },
      });
    } catch {
      setIsPlaying(false);
    }
  }, [speed]);

  const handlePause = useCallback(() => {
    if (!writerRef.current) return;
    try {
      writerRef.current.pauseAnimation();
    } catch {}
    setIsPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    if (!writerRef.current) return;
    setIsPlaying(false);
    setQuizCompleted(false);
    setMistakes(0);
    setCurrentStroke(0);

    try {
      if (mode === "quiz") {
        startQuizMode(writerRef.current);
      } else {
        writerRef.current.showCharacter();
        if (showOutline) writerRef.current.showOutline();
      }
    } catch {}
  }, [mode, showOutline]);

  const handleStepNext = useCallback(() => {
    if (!writerRef.current || strokeCount === 0) return;
    setIsPlaying(false);
    const nextIdx = currentStroke % strokeCount;
    try {
      writerRef.current.animateStroke(nextIdx, { strokeAnimationSpeed: speed });
      setCurrentStroke(nextIdx + 1);
    } catch {}
  }, [currentStroke, strokeCount, speed]);

  // ─── Quiz / Practice Mode ────────────────────────────────────────────────
  const startQuizMode = (writerInstance: HanziWriterInstance) => {
    if (!writerInstance) return;
    setQuizCompleted(false);
    setMistakes(0);
    setCurrentStroke(0);

    writerInstance.quiz({
      showOutline: showOutline,
      onCorrectStroke: (data: HanziStrokeData) => {
        setCurrentStroke(data.strokeNum + 1);
      },
      onMistake: () => {
        setMistakes((prev) => prev + 1);
      },
      onComplete: () => {
        setQuizCompleted(true);
        setCurrentStroke(strokeCount);
      },
    });
  };

  const switchMode = (newMode: "view" | "quiz") => {
    setMode(newMode);
    setIsPlaying(false);
    setQuizCompleted(false);
    setMistakes(0);
    setCurrentStroke(0);

    if (!writerRef.current) return;

    if (newMode === "quiz") {
      startQuizMode(writerRef.current);
    } else {
      writerRef.current.cancelQuiz();
      writerRef.current.showCharacter();
      if (showOutline) writerRef.current.showOutline();
    }
  };

  return (
    <div className={`flex flex-col items-center gap-4 select-none ${className}`}>
      {/* Kanji Meta Banner */}
      {(hanViet || meaning) && (
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center">
          {hanViet && (
            <span className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              {hanViet}
            </span>
          )}
          {meaning && (
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {meaning}
            </span>
          )}
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => switchMode("view")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
            mode === "view"
              ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Xem Nét Viết (Animation)</span>
        </button>

        <button
          onClick={() => switchMode("quiz")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
            mode === "quiz"
              ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Tập Viết & Chấm Điểm (Quiz)</span>
        </button>
      </div>

      {/* Main Canvas Area with 田 Grid */}
      <div className="relative rounded-3xl p-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Tian Grid Background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none p-2"
          viewBox={`0 0 ${size} ${size}`}
        >
          <rect
            x="4"
            y="4"
            width={size - 8}
            height={size - 8}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            rx="16"
          />
          <line
            x1={size / 2}
            y1="4"
            x2={size / 2}
            y2={size - 4}
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1="4"
            y1={size / 2}
            x2={size - 4}
            y2={size / 2}
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={size / 4}
            y1="4"
            x2={size / 4}
            y2={size - 4}
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          <line
            x1={(size * 3) / 4}
            y1="4"
            x2={(size * 3) / 4}
            y2={size - 4}
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          <line
            x1="4"
            y1={size / 4}
            x2={size - 4}
            y2={size / 4}
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          <line
            x1="4"
            y1={(size * 3) / 4}
            x2={size - 4}
            y2={(size * 3) / 4}
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
        </svg>

        {/* HanziWriter Container Target */}
        <div
          ref={containerRef}
          className="relative z-10 flex items-center justify-center cursor-crosshair"
          style={{ width: `${size}px`, height: `${size}px` }}
        />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs gap-2">
            <div className="w-8 h-8 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
            <span className="text-[11px] font-bold text-slate-500">Đang tải nét chữ...</span>
          </div>
        )}

        {/* Load Error Fallback */}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900/95 p-4 text-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Không tải được dữ liệu nét chữ KanjiVG cho chữ &ldquo;{kanji}&rdquo;.
            </span>
          </div>
        )}

        {/* Quiz Success Celebration Overlay */}
        {quizCompleted && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-500/90 backdrop-blur-xs text-white p-4 text-center animate-in zoom-in-95 duration-200">
            <Sparkles className="w-10 h-10 mb-2 animate-bounce" />
            <h4 className="text-base font-black uppercase tracking-wider">Xuất Sắc!</h4>
            <p className="text-xs font-semibold opacity-90 mt-1">
              Bạn đã viết đúng toàn bộ {strokeCount} nét chữ {kanji}!
            </p>
            {mistakes > 0 ? (
              <span className="text-[11px] mt-1 bg-black/20 px-2 py-0.5 rounded-full font-mono">
                Số lần sửa: {mistakes} lỗi
              </span>
            ) : (
              <span className="text-[11px] mt-1 bg-black/20 px-2 py-0.5 rounded-full font-bold">
                🎯 Hoàn hảo (0 lỗi)
              </span>
            )}
            <button
              onClick={handleReset}
              className="mt-3 px-4 py-1.5 rounded-xl bg-white text-emerald-700 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Viết Lại Lần Nữa
            </button>
          </div>
        )}
      </div>

      {/* Practice Progress Bar during Quiz Mode */}
      {mode === "quiz" && (
        <div className="w-full max-w-xs flex items-center justify-between text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-slate-600 dark:text-slate-400">
            Tiến độ: <strong className="text-orange-600 dark:text-orange-400">{currentStroke}</strong> / {strokeCount} nét
          </span>
          <span className="text-rose-500">
            Lỗi sai: <strong className="font-mono">{mistakes}</strong>
          </span>
        </div>
      )}

      {/* Control Buttons Toolbar */}
      <div className="flex items-center gap-2 flex-wrap justify-center bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-700/80">
        {mode === "view" ? (
          <>
            {/* Play/Pause */}
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              <span>{isPlaying ? "Tạm Dừng" : "Phát Animation"}</span>
            </button>

            {/* Step Next */}
            <button
              onClick={handleStepNext}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
              title="Vẽ nét tiếp theo"
            >
              <SkipForward className="w-3.5 h-3.5 text-orange-500" />
              <span>Từng Nét</span>
            </button>

            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s as SpeedMultiplier)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors ${
                    speed === s
                      ? "bg-orange-600 text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Quiz Mode Tools */
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2">
            ✍️ Dùng chuột hoặc ngón tay (Touch) vẽ theo thứ tự nét
          </div>
        )}

        {/* Toggle Guide Outline */}
        <button
          onClick={toggleOutline}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors shadow-2xs ${
            showOutline
              ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
          }`}
          title="Bật/Tắt nét mờ hướng dẫn"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{showOutline ? "Nét Mẫu: Bật" : "Nét Mẫu: Tắt"}</span>
        </button>

        {/* Reset / Clear */}
        <button
          onClick={handleReset}
          className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
          title="Vẽ lại từ đầu"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
