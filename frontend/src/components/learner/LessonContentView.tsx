"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Lesson, Resource, VocabularyEntry, api } from "@/lib/api";
import { DriveVideoPlayer } from "./DriveVideoPlayer";
import { AudioPlayer } from "./AudioPlayer";
import { DocumentViewer } from "./DocumentViewer";
import { playJapaneseSpeech } from "@/lib/tts";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import {
  BookOpen, FileText, FileAudio, FileCheck, HelpCircle, CheckCircle2,
  Volume2, ExternalLink, Sparkles, Eye, EyeOff, Lightbulb, ArrowRight,
  Plus, Loader2, BrainCircuit, PlayCircle, Headphones, Download, Star
} from "lucide-react";

const KanjiCanvas = dynamic(
  () => import("./KanjiCanvas").then((mod) => mod.KanjiCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Đang tải bảng vẽ Kanji...</span>
      </div>
    ),
  }
);

interface LessonContentViewProps {
  lesson: Lesson;
  courseTitle: string;
  sectionTitle: string;
  isCompleted: boolean;
  onToggleComplete: () => void;
  onLaunchQuiz?: () => void;
}

export const LessonContentView: React.FC<LessonContentViewProps> = ({
  lesson,
  courseTitle,
  sectionTitle,
  isCompleted,
  onToggleComplete,
  onLaunchQuiz,
}) => {
  const { t } = useI18n();
  const { isVocabFavorite, toggleVocabFavorite, isKanjiFavorite, toggleKanjiFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<"vocab" | "notes" | "audio" | "pdf" | "quiz" | "kanji">("vocab");
  const [showFurigana, setShowFurigana] = useState(true);
  const [vocabFilter, setVocabFilter] = useState<"all" | "fav">("all");
  const [showKanji, setShowKanji] = useState<Record<string, boolean>>({});
  const [activeKanji, setActiveKanji] = useState<string>("私");

  // Live vocabulary state
  const [vocabList, setVocabList] = useState<VocabularyEntry[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [addingToSrs, setAddingToSrs] = useState<Record<string, "idle" | "loading" | "done">>({});

  // Active Primary Resource on Center Stage
  const [activePrimaryResId, setActivePrimaryResId] = useState<string | null>(null);

  const audioResources = lesson.resources.filter((r) => r.resourceType === 1);
  const pdfResources = lesson.resources.filter((r) => r.resourceType === 2 || r.resourceType === 3 || r.resourceType === 5 || r.resourceType === 4);

  // Extract all unique Kanji from vocabulary list
  const lessonKanjiList = React.useMemo(() => {
    const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/g;
    const found = new Set<string>();
    vocabList.forEach((v) => {
      const matches = v.word.match(kanjiRegex);
      if (matches) matches.forEach((m) => found.add(m));
    });
    if (found.size === 0) {
      ["私", "先", "生", "学", "日", "本", "語", "人", "大", "小", "中"].forEach((k) => found.add(k));
    }
    return Array.from(found);
  }, [vocabList]);

  // Set default active Kanji when list updates
  useEffect(() => {
    if (lessonKanjiList.length > 0 && !lessonKanjiList.includes(activeKanji)) {
      setActiveKanji(lessonKanjiList[0]);
    }
  }, [lessonKanjiList]);

  // Determine current active primary resource (Default priority: Video -> Document -> Audio)
  const currentPrimaryResource = React.useMemo(() => {
    if (activePrimaryResId) {
      const found = lesson.resources.find((r) => r.id === activePrimaryResId);
      if (found) return found;
    }
    const video = lesson.resources.find((r) => r.resourceType === 0);
    if (video) return video;
    const doc = lesson.resources.find((r) => r.resourceType === 2 || r.resourceType === 3 || r.resourceType === 5);
    if (doc) return doc;
    const audio = lesson.resources.find((r) => r.resourceType === 1);
    if (audio) return audio;
    return lesson.resources[0] || null;
  }, [lesson.resources, activePrimaryResId]);

  // Load live vocab whenever lesson changes
  useEffect(() => {
    const loadVocab = async () => {
      setVocabLoading(true);
      try {
        const data = await api.getVocabulary(lesson.id);
        setVocabList(data);
      } catch (err) {
        console.error("Failed to load lesson vocabulary", err);
      } finally {
        setVocabLoading(false);
      }
    };
    loadVocab();
    setAddingToSrs({});
    setActivePrimaryResId(null);
  }, [lesson.id]);

  const handleAddToSrs = async (vocabId: string) => {
    setAddingToSrs((prev) => ({ ...prev, [vocabId]: "loading" }));
    try {
      await api.addVocabToSrsDeck(vocabId);
      setAddingToSrs((prev) => ({ ...prev, [vocabId]: "done" }));
    } catch {
      setAddingToSrs((prev) => ({ ...prev, [vocabId]: "idle" }));
    }
  };

  const toggleKanjiCanvas = (vocabId: string) => {
    setShowKanji((prev) => ({ ...prev, [vocabId]: !prev[vocabId] }));
  };

  // Extract single kanji character from word for canvas display
  const extractKanji = (word: string): string | null => {
    const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/;
    const match = word.match(kanjiRegex);
    return match ? match[0] : null;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 bg-slate-50/50 dark:bg-slate-950">
      {/* Lesson Title Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
            <span>{courseTitle}</span>
            <span>•</span>
            <span>{sectionTitle}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{lesson.title}</h1>
          {lesson.estimatedDurationMinutes && (
            <span className="text-xs text-slate-400 mt-0.5">⏱ {lesson.estimatedDurationMinutes} phút</span>
          )}
        </div>

        {/* Mark as Completed Button */}
        <button
          onClick={onToggleComplete}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-95 ${
            isCompleted
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-500/20"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {isCompleted ? "Đã Hoàn Thành ✓" : "Đánh Dấu Hoàn Thành"}
        </button>
      </div>

      {/* ── Resource Switcher Bar (when lesson has multiple resources or assigned quiz) ── */}
      {(lesson.resources.length > 1 || (lesson.quizzes && lesson.quizzes.length > 0)) && (
        <div className="shrink-0 flex items-center gap-2 overflow-x-auto p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 px-2">
            Tài nguyên bài học:
          </span>
          {lesson.resources.map((res) => {
            const isSelected = (currentPrimaryResource?.id === res.id);
            return (
              <button
                key={res.id}
                onClick={() => setActivePrimaryResId(res.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border whitespace-nowrap ${
                  isSelected
                    ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent shadow-md shadow-orange-500/20"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-500/50"
                }`}
              >
                {res.resourceType === 0 ? (
                  <PlayCircle className="w-4 h-4 shrink-0" />
                ) : res.resourceType === 1 ? (
                  <Headphones className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : (
                  <FileText className="w-4 h-4 shrink-0 text-rose-500" />
                )}
                <span className="truncate max-w-[220px]">{res.title}</span>
              </button>
            );
          })}

          {/* Assigned Quizzes Pills */}
          {lesson.quizzes && lesson.quizzes.map((q) => (
            <button
              key={q.id}
              onClick={onLaunchQuiz}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/20 active:scale-95 shadow-sm whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="truncate max-w-[220px]">Đề Thi: {q.title} ({q.questionCount} câu)</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Main Adaptive Stage (Video / PDF / Document / Audio / Quiz) ── */}
      {currentPrimaryResource ? (
        currentPrimaryResource.resourceType === 0 ? (
          /* Video Lesson */
          <DriveVideoPlayer
            title={currentPrimaryResource.title || lesson.title}
            driveFileId={currentPrimaryResource.driveFileId}
            customUrl={currentPrimaryResource.customUrl}
            lessonId={lesson.id}
          />
        ) : (currentPrimaryResource.resourceType === 2 || currentPrimaryResource.resourceType === 3 || currentPrimaryResource.resourceType === 5 || currentPrimaryResource.resourceType === 4) ? (
          /* PDF / Document / Text Lesson */
          <DocumentViewer
            title={currentPrimaryResource.title || lesson.title}
            driveFileId={currentPrimaryResource.driveFileId}
            customUrl={currentPrimaryResource.customUrl}
            resourceType={currentPrimaryResource.resourceType}
            lessonId={lesson.id}
          />
        ) : currentPrimaryResource.resourceType === 1 ? (
          /* Audio Lesson */
          <div className="w-full shrink-0">
            <AudioPlayer
              title={currentPrimaryResource.title || lesson.title}
              driveFileId={currentPrimaryResource.driveFileId}
              audioUrl={currentPrimaryResource.customUrl}
              lessonId={lesson.id}
            />
          </div>
        ) : null
      ) : (lesson.quizzes && lesson.quizzes.length > 0) ? (
        /* Quiz as Center Stage */
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 shadow-xl flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/10 animate-bounce">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-xs border border-amber-500/20 uppercase tracking-wide">
              Đề Thi / Quiz Trọng Tâm
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
              {lesson.quizzes[0].title}
            </h2>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Bài học này là bài luyện tập trắc nghiệm / kiểm tra ({lesson.quizzes[0].questionCount} câu hỏi).
            </p>
          </div>
          <button
            onClick={onLaunchQuiz}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm shadow-xl shadow-orange-500/25 active:scale-95 flex items-center gap-2.5 transition-all cursor-pointer"
          >
            <span>Bắt Đầu Làm Bài Ngay</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Empty resource placeholder */
        <div className="w-full h-64 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 gap-3 p-6 shadow-inner">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-center text-slate-400">Bài học này chưa có tệp đa phương tiện đính kèm.</p>
        </div>
      )}

      {/* Prep / Riki Style Content Navigation Tabs */}
      <div className="flex flex-col gap-4">
        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 border-b border-slate-200/80 dark:border-slate-800 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("vocab")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "vocab"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BookOpen className="w-4 h-4 text-orange-500" />
            📚 Từ Vựng {vocabLoading ? "(…)" : `(${vocabList.length})`}
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "notes"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-500" />
            📝 Ngữ Pháp
          </button>

          <button
            onClick={() => setActiveTab("audio")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "audio"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileAudio className="w-4 h-4 text-emerald-500" />
            🎧 Luyện Nghe ({audioResources.length})
          </button>

          <button
            onClick={() => setActiveTab("pdf")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "pdf"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileCheck className="w-4 h-4 text-rose-500" />
            📄 Tài Liệu ({pdfResources.length})
          </button>

          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "quiz"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-500" />
            ✍️ Quiz
          </button>

          <button
            onClick={() => setActiveTab("kanji")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "kanji"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BrainCircuit className="w-4 h-4 text-indigo-500" />
            🎌 Luyện Viết Kanji ({lessonKanjiList.length})
          </button>
        </div>

        {/* Tab Panes Container */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[300px]">

          {/* ── TAB 1: VOCABULARY ── */}
          {activeTab === "vocab" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Bộ Từ Vựng — {lesson.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Favorites Filter Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setVocabFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        vocabFilter === "all"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Tất Cả ({vocabList.length})
                    </button>
                    <button
                      onClick={() => setVocabFilter("fav")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        vocabFilter === "fav"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      }`}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      Yêu Thích ({vocabList.filter((v) => isVocabFavorite(v.id)).length})
                    </button>
                  </div>

                  {/* Furigana Toggle */}
                  <button
                    onClick={() => setShowFurigana(!showFurigana)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    {showFurigana ? <EyeOff className="w-3.5 h-3.5 text-orange-500" /> : <Eye className="w-3.5 h-3.5 text-indigo-500" />}
                    {showFurigana ? "Ẩn Furigana" : "Hiện Furigana"}
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {vocabLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tải từ vựng...</span>
                </div>
              ) : vocabList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 text-slate-400">
                  <BookOpen className="w-8 h-8 opacity-40" />
                  <p className="text-xs font-medium">Chưa có từ vựng nào cho bài học này.</p>
                  <p className="text-[11px] text-slate-300 dark:text-slate-600">Thêm từ vựng trong Admin → Từ Vựng CMS.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {vocabList
                    .filter((item) => (vocabFilter === "all" || isVocabFavorite(item.id)))
                    .map((item) => {
                    const srsStatus = addingToSrs[item.id] || "idle";
                    const kanjiChar = extractKanji(item.word);
                    const isFav = isVocabFavorite(item.id);

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-orange-500/40 transition-all flex flex-col gap-2.5 shadow-2xs group"
                      >
                        {/* Word + reading + POS + SRS button */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            {showFurigana && item.reading !== item.word ? (
                              <ruby className="text-xl font-extrabold text-slate-900 dark:text-white">
                                {item.word}
                                <rt className="text-xs text-orange-600 dark:text-orange-400 font-bold">{item.reading}</rt>
                              </ruby>
                            ) : (
                              <span className="text-xl font-extrabold text-slate-900 dark:text-white">{item.word}</span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-[10px]">
                              {item.jlptLevel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Star Favorite button */}
                            <button
                              onClick={() => toggleVocabFavorite(item.id)}
                              title={isFav ? "Bỏ khỏi danh sách yêu thích" : "Lưu vào từ vựng yêu thích"}
                              className={`p-1.5 rounded-lg text-xs transition-all border ${
                                isFav
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-500"
                                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500"
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-500 text-amber-500" : ""}`} />
                            </button>

                            {/* KanjiCanvas toggle */}
                            {kanjiChar && (
                              <button
                                onClick={() => toggleKanjiCanvas(item.id)}
                                title="Xem thứ tự nét Kanji"
                                className={`p-1.5 rounded-lg text-xs transition-all border ${
                                  showKanji[item.id]
                                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500"
                                }`}
                              >
                                <BrainCircuit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Add to SRS */}
                            <button
                              onClick={() => srsStatus === "idle" && handleAddToSrs(item.id)}
                              disabled={srsStatus !== "idle"}
                              title={srsStatus === "done" ? "Đã thêm vào bộ thẻ SRS" : "Thêm vào bộ thẻ ôn tập SRS"}
                              className={`p-1.5 rounded-lg text-xs transition-all border ${
                                srsStatus === "done"
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                  : srsStatus === "loading"
                                  ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                              }`}
                            >
                              {srsStatus === "loading" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : srsStatus === "done" ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* POS tag */}
                        <span className="self-start px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                          {item.partOfSpeech}
                        </span>

                        {/* Meaning */}
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.meaning}</p>

                        {/* KanjiCanvas (collapsible) */}
                        {kanjiChar && showKanji[item.id] && (
                          <div className="flex justify-center py-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                            <KanjiCanvas kanji={kanjiChar} size={140} />
                          </div>
                        )}

                        {/* Example sentence */}
                        {item.exampleSentence && (
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 text-xs mt-1">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{item.exampleSentence}</p>
                            {item.exampleSentenceTranslation && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5">{item.exampleSentenceTranslation}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: GRAMMAR NOTES ─────────────────────────────────────── */}
          {activeTab === "notes" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Cấu Trúc Ngữ Pháp Trọng Tâm</h3>
              </div>

              <div className="p-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white font-extrabold text-[10px]">Cấu trúc 1</span>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">Khẳng định: N1 は N2 です</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Trợ từ <span className="font-bold text-orange-500">は (wa)</span> đứng sau chủ ngữ N1. <span className="font-bold text-indigo-500">です (desu)</span> cuối câu biểu thị lịch sự.
                </p>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Ví dụ: わたし は マイク・ミラー です。</p>
                  <p className="text-slate-500 text-[11px]">→ Tôi là Mike Miller.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500 text-white font-extrabold text-[10px]">Cấu trúc 2</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Phủ định: N1 は N2 じゃありません</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Dạng phủ định: <span className="font-bold text-rose-500">じゃありません</span> hoặc <span className="font-bold text-rose-400">ではありません</span>.
                </p>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Ví dụ: サントスさん は 学生 じゃありません。</p>
                  <p className="text-slate-500 text-[11px]">→ Anh Santos không phải là sinh viên.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: AUDIO PLAYLIST ───────────────────────────────────────── */}
          {activeTab === "audio" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Danh Sách Audio Luyện Nghe ({audioResources.length} bài)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Bấm để chọn track phát trên trình phát chính</span>
              </div>

              {audioResources.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  Chưa gắn tệp âm thanh cho bài học này.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {audioResources.map((audio, index) => {
                    const isCurrent = (currentPrimaryResource?.id === audio.id);
                    return (
                      <div
                        key={audio.id}
                        onClick={() => setActivePrimaryResId(audio.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isCurrent
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/30"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-emerald-400 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          }`}>
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs truncate">{audio.title}</h4>
                            <span className="text-[10px] text-slate-400">Audio Track MP3</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrent ? (
                            <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold shadow-xs">
                              🎵 Đang Phát
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActivePrimaryResId(audio.id); }}
                              className="px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors"
                            >
                              ▶ Chọn Track
                            </button>
                          )}
                          {audio.driveFileId && (
                            <a
                              href={`https://drive.google.com/file/d/${audio.driveFileId}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Mở Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: PDF ───────────────────────────────────────────────── */}
          {activeTab === "pdf" && (
            <div className="flex flex-col gap-4">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Tài Liệu & Bài Tập PDF</h3>
              {pdfResources.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">Chưa gắn tài liệu PDF cho bài học này.</div>
              ) : (
                pdfResources.map((pdf) => (
                  <div key={pdf.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{pdf.title}</span>
                    {pdf.driveFileId && (
                      <a
                        href={`https://drive.google.com/file/d/${pdf.driveFileId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Mở PDF
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TAB 5: QUIZ ──────────────────────────────────────────────── */}
          {activeTab === "quiz" && (
            <div className="flex flex-col gap-4 items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-1">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Bài Tập Tự Luyện</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Kiểm tra kiến thức từ vựng và ngữ pháp vừa học để củng cố bài học và lưu tiến độ tự động.
              </p>
              <button
                onClick={onLaunchQuiz}
                className="mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 active:scale-95 flex items-center gap-2 transition-all"
              >
                <span>Bắt Đầu Làm Bài Tự Luyện</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── TAB 6: KANJI PRACTICE CANVAS ───────────────────────────── */}
          {activeTab === "kanji" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Tập Viết Kanji Chữ Hán — {lesson.title}
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">KanjiVG CDN AI Stroke Engine</span>
              </div>

              {/* Kanji Selector Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-bold text-slate-500 shrink-0">Chọn chữ tập viết:</span>
                {lessonKanjiList.map((k) => (
                  <button
                    key={k}
                    onClick={() => setActiveKanji(k)}
                    className={`w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center transition-all shrink-0 border ${
                      activeKanji === k
                        ? "bg-orange-600 text-white border-orange-500 shadow-md scale-105"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

                            {/* Kanji Canvas Component */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
                <KanjiCanvas kanji={activeKanji || "私"} size={260} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
