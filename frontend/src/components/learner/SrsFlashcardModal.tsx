"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { api, SrsDueItem } from "@/lib/api";
import { playJapaneseSpeech } from "@/lib/tts";
import { useFavorites } from "@/lib/favorites";
import {
  BookOpen, CheckCircle, X, Sparkles, RotateCw, BrainCircuit,
  ChevronRight, Award, Volume2, Image as ImageIcon, Star, Loader2
} from "lucide-react";

const KanjiCanvas = dynamic(
  () => import("./KanjiCanvas").then((mod) => mod.KanjiCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-4 text-slate-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Đang nạp bảng vẽ...</span>
      </div>
    ),
  }
);

interface SrsFlashcardModalProps {
  onClose: () => void;
}

export const SrsFlashcardModal: React.FC<SrsFlashcardModalProps> = ({ onClose }) => {
  const { isVocabFavorite, toggleVocabFavorite } = useFavorites();
  const [dueItems, setDueItems] = useState<SrsDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showKanjiCanvas, setShowKanjiCanvas] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    const fetchDue = async () => {
      try {
        setLoading(true);
        const data = await api.getSrsDueCards();
        setDueItems(data);
      } catch {
        setDueItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDue();
  }, []);

  const currentItem = dueItems[currentIndex];

  // Parse extra tagsJson for Image and HanViet
  let parsedMeta: { imageUrl?: string; hanViet?: string } = {};
  if (currentItem?.vocabulary?.tagsJson) {
    try {
      parsedMeta = JSON.parse(currentItem.vocabulary.tagsJson);
    } catch {}
  }

  const handlePlaySpeech = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentItem) return;
    setIsPlayingAudio(true);
    const speechText = currentItem.vocabulary.reading || currentItem.vocabulary.word;
    playJapaneseSpeech(speechText).finally(() => setIsPlayingAudio(false));
  };

  const handleRate = useCallback(async (qualityRating: number) => {
    if (!currentItem) return;

    // Send review score to backend SM-2 / Anki engine
    api.submitSrsReview(currentItem.vocabulary.id, qualityRating).catch(console.warn);

    setReviewedCount((prev) => prev + 1);
    setShowAnswer(false);
    setShowKanjiCanvas(false);

    // Anki In-Session Queue Mechanism:
    // If "Lặp lại" (0) or "Khó" (1), push card back into queue so it reappears before session ends!
    let nextQueue = [...dueItems];
    if (qualityRating === 0 || qualityRating === 1) {
      nextQueue.push(currentItem);
      setDueItems(nextQueue);
    }

    if (currentIndex + 1 < nextQueue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionCompleted(true);
    }
  }, [currentItem, currentIndex, dueItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!showAnswer) {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          setShowAnswer(true);
        }
        return;
      }
      if (e.code === "Digit1" || e.code === "KeyA") handleRate(0);
      else if (e.code === "Digit2" || e.code === "KeyS") handleRate(1);
      else if (e.code === "Digit3" || e.code === "KeyD") handleRate(2);
      else if (e.code === "Digit4" || e.code === "KeyF") handleRate(3);
      else if (e.code === "KeyR") handlePlaySpeech();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAnswer, handleRate, currentItem]);

  // Get kanji char from word
  const getKanjiChar = (word: string): string | null => {
    const match = word.match(/[\u4e00-\u9faf\u3400-\u4dbf]/);
    return match ? match[0] : null;
  };

  // Next interval preview labels (Anki standard: < 1 phút, < 10 phút, 1 ngày, 3 ngày)
  const intervalLabels = ["< 1 phút", "< 10 phút", "1 ngày", "3 ngày"];
  const ratingLabels = ["Lặp lại", "Khó", "Tốt", "Dễ"];
  const ratingColors = [
    "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20",
    "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20",
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20",
    "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col min-h-[520px] max-h-[90vh]">

        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Ôn Từ Vựng SRS (Chuẩn Anki)</h3>
              <span className="text-[10px] text-slate-400 font-mono">Space/Enter = lật · 1234 = đánh giá · R = đọc âm</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="text-xs text-slate-400 animate-pulse flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              <span>Đang nạp danh sách thẻ từ vựng cần ôn...</span>
            </div>
          ) : sessionCompleted || dueItems.length === 0 ? (
            /* ── Session Complete Screen ── */
            <div className="flex flex-col items-center text-center gap-4 p-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Hoàn Thành Toàn Bộ Phiên Ôn Tập! 🎉</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Bạn đã xuất sắc vượt qua tất cả thẻ từ vựng trong phiên học hôm nay (đã ôn <strong className="text-orange-500">{reviewedCount}</strong> lượt).
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-6 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all active:scale-95">
                  Đóng & Hoàn Tất
                </button>
              </div>
            </div>
          ) : currentItem ? (
            /* ── Flashcard View ── */
            <div className="w-full flex flex-col items-center gap-4">
              {/* Progress bar + meta */}
              <div className="w-full">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono font-bold mb-1.5">
                  <span>Thẻ {currentIndex + 1} / {dueItems.length} {currentIndex >= dueItems.length - 1 && "(Vòng lặp cuối)"}</span>
                  <div className="flex items-center gap-1.5">
                    {/* Star Favorite Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentItem?.vocabulary?.id) toggleVocabFavorite(currentItem.vocabulary.id);
                      }}
                      title={currentItem?.vocabulary?.id && isVocabFavorite(currentItem.vocabulary.id) ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                      className={`p-1 rounded-lg border transition-all ${
                        currentItem?.vocabulary?.id && isVocabFavorite(currentItem.vocabulary.id)
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500"
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${currentItem?.vocabulary?.id && isVocabFavorite(currentItem.vocabulary.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                    </button>

                    {parsedMeta.hanViet && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase">
                        {parsedMeta.hanViet}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold text-[10px]">
                      JLPT {currentItem.vocabulary.jlptLevel}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, ((currentIndex + 1) / dueItems.length) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 3D Flip Card */}
              <div
                onClick={() => !showAnswer && setShowAnswer(true)}
                className="w-full min-h-[230px] [perspective:1000px] cursor-pointer group"
              >
                <div
                  className={`relative w-full h-full min-h-[230px] rounded-3xl transition-transform duration-500 [transform-style:preserve-3d] shadow-xl ${
                    showAnswer ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  {/* Front Face */}
                  <div className="absolute inset-0 w-full h-full rounded-3xl p-6 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800/90 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700/80 [backface-visibility:hidden] flex flex-col items-center justify-center text-center gap-3">
                    {/* Furigana Reading */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                        {currentItem.vocabulary.reading}
                      </span>
                      <button
                        onClick={handlePlaySpeech}
                        className="p-1.5 rounded-full bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors"
                        title="Nghe phát âm tiếng Nhật"
                      >
                        <Volume2 className={`w-4 h-4 ${isPlayingAudio ? "animate-pulse" : ""}`} />
                      </button>
                    </div>

                    {/* Word Character */}
                    <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                      {currentItem.vocabulary.word}
                    </h2>

                    {/* Illustration image (if available) */}
                    {parsedMeta.imageUrl && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <img
                          src={parsedMeta.imageUrl}
                          alt={currentItem.vocabulary.word}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase">
                        {currentItem.vocabulary.partOfSpeech}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mt-1 group-hover:text-orange-500 transition-colors">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Nhấn để lật thẻ · Space / Enter</span>
                    </div>
                  </div>

                  {/* Back Face */}
                  <div className="absolute inset-0 w-full h-full rounded-3xl p-5 bg-slate-900 border-2 border-orange-500/50 text-white [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col items-center justify-center text-center gap-2.5 shadow-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                        {currentItem.vocabulary.word} · {currentItem.vocabulary.reading}
                      </span>
                      <button
                        onClick={handlePlaySpeech}
                        className="p-1 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-2xl font-black text-white leading-tight">{currentItem.vocabulary.meaning}</p>

                    {/* Illustration image on back face */}
                    {parsedMeta.imageUrl && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-orange-500/30 shadow-md">
                        <img
                          src={parsedMeta.imageUrl}
                          alt={currentItem.vocabulary.word}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {currentItem.vocabulary.exampleSentence && (
                      <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 text-xs w-full mt-1 text-left flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-200">{currentItem.vocabulary.exampleSentence}</p>
                          {currentItem.vocabulary.exampleSentenceTranslation && (
                            <p className="text-[11px] text-slate-400 italic mt-0.5">{currentItem.vocabulary.exampleSentenceTranslation}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playJapaneseSpeech(currentItem.vocabulary.exampleSentence!);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-700 shrink-0"
                          title="Đọc câu ví dụ"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* KanjiCanvas toggle button */}
              {getKanjiChar(currentItem.vocabulary.word) && (
                <button
                  onClick={() => setShowKanjiCanvas((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    showKanjiCanvas
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500"
                  }`}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  {showKanjiCanvas ? "Ẩn bảng tập viết" : "Xem thứ tự nét & Luyện viết Kanji"}
                </button>
              )}

              {/* KanjiCanvas popup */}
              {showKanjiCanvas && getKanjiChar(currentItem.vocabulary.word) && (
                <div className="w-full flex justify-center py-2 border border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
                  <KanjiCanvas kanji={getKanjiChar(currentItem.vocabulary.word)!} size={170} />
                </div>
              )}

              {/* Rating Actions */}
              {showAnswer ? (
                <div className="grid grid-cols-4 gap-2 w-full pt-1">
                  {[0, 1, 2, 3].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleRate(rating)}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border transition-all font-bold ${ratingColors[rating]} active:scale-95 shadow-sm`}
                    >
                      <span className="text-xs">{ratingLabels[rating]}</span>
                      <span className="text-[10px] font-extrabold mt-0.5 opacity-75">{intervalLabels[rating]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Xem Đáp Án (Space / Enter)
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
