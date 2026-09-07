"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Lesson, Resource, VocabularyEntry, Course, Section, api } from "@/lib/api";
import { DriveVideoPlayer } from "./DriveVideoPlayer";
import { AudioPlayer } from "./AudioPlayer";
import { DocumentViewer } from "./DocumentViewer";
import { CourseCurriculumCard } from "./CourseCurriculumCard";
import { AiSenseiWidget } from "./AiSenseiWidget";
import { playJapaneseSpeech } from "@/lib/tts";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import {
  BookOpen, FileText, FileAudio, FileCheck, HelpCircle, CheckCircle2,
  Volume2, ExternalLink, Sparkles, Eye, EyeOff, Lightbulb, ArrowRight,
  Plus, Loader2, BrainCircuit, PlayCircle, Headphones, Download, Star, Circle,
  ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen
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
  course?: Course;
  courseTitle: string;
  sectionTitle: string;
  isCompleted: boolean;
  completedLessonIds?: Record<string, boolean>;
  onSelectLesson?: (lesson: Lesson, course: Course, section: Section) => void;
  onToggleComplete: () => void;
  onLaunchQuiz?: () => void;
  onNextLesson?: () => void;
  hasNextLesson?: boolean;
}

export const LessonContentView: React.FC<LessonContentViewProps> = ({
  lesson,
  course,
  courseTitle,
  sectionTitle,
  isCompleted,
  completedLessonIds = {},
  onSelectLesson,
  onToggleComplete,
  onLaunchQuiz,
  onNextLesson,
  hasNextLesson,
}) => {
  const { t } = useI18n();
  const { isVocabFavorite, toggleVocabFavorite, isKanjiFavorite, toggleKanjiFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<"vocab" | "notes" | "audio" | "pdf" | "quiz" | "kanji">("vocab");
  const [showFurigana, setShowFurigana] = useState(true);
  const [vocabFilter, setVocabFilter] = useState<"all" | "fav">("all");
  const [showKanji, setShowKanji] = useState<Record<string, boolean>>({});
  const [activeKanji, setActiveKanji] = useState<string>("私");

  // Live vocabulary state & JLPT Fallback info
  const [vocabList, setVocabList] = useState<VocabularyEntry[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [isVocabFallback, setIsVocabFallback] = useState(false);
  const [vocabCourseLevel, setVocabCourseLevel] = useState<string>("N3");
  const [addingToSrs, setAddingToSrs] = useState<Record<string, "idle" | "loading" | "done">>({});

  // Live Kanji state & JLPT Fallback info
  const [kanjiList, setKanjiList] = useState<string[]>([]);
  const [kanjiLoading, setKanjiLoading] = useState(false);
  const [isKanjiFallback, setIsKanjiFallback] = useState(false);
  const [kanjiCourseLevel, setKanjiCourseLevel] = useState<string>("N3");

  // Active Primary Resource on Center Stage
  const [activePrimaryResId, setActivePrimaryResId] = useState<string | null>(null);

  // Micro-Progress State per Resource
  const [resourceProgressMap, setResourceProgressMap] = useState<Record<string, boolean>>({});

  // Horizontal Scrolling & Auto-Centering Refs for Resource Tabs Bar
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabItemRefs = useRef<Record<string, HTMLElement | null>>({});

  const audioResources = lesson.resources.filter((r) => r.resourceType === 1);
  const pdfResources = lesson.resources.filter((r) => r.resourceType === 2 || r.resourceType === 3 || r.resourceType === 5 || r.resourceType === 4);

  // Set default active Kanji when list updates
  useEffect(() => {
    if (kanjiList.length > 0 && !kanjiList.includes(activeKanji)) {
      setActiveKanji(kanjiList[0]);
    }
  }, [kanjiList]);

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

  // Auto-scroll the active tab smoothly into center view (local container only)
  useEffect(() => {
    const el = currentPrimaryResource?.id ? tabItemRefs.current[currentPrimaryResource.id] : null;
    const container = tabsContainerRef.current;
    if (el && container) {
      const offsetLeft = el.offsetLeft - container.offsetLeft;
      const targetScrollLeft = offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: "smooth",
      });
    }
  }, [currentPrimaryResource?.id]);

  // Toggle curriculum & AI sidebar visibility (default true)
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("nihongo_show_curriculum_sidebar");
    if (saved !== null) {
      setShowSidebar(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setShowSidebar((prev) => {
      const next = !prev;
      localStorage.setItem("nihongo_show_curriculum_sidebar", String(next));
      return next;
    });
  };

  // Handle standard mouse wheel scrolling horizontally over resource tabs
  const handleTabsWheel = (e: React.WheelEvent) => {
    if (e.deltaY !== 0 && tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Scroll tabs container smoothly left or right via navigation buttons
  const scrollTabs = (direction: "left" | "right") => {
    if (tabsContainerRef.current) {
      const scrollAmount = 240;
      tabsContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Load live vocab, live kanjis & micro-progress whenever lesson changes
  useEffect(() => {
    const loadVocabAndKanji = async () => {
      if (!lesson.id) return;
      const targetLevel = course?.jlptLevel || "N3";

      setVocabLoading(true);
      try {
        const vocabRes = await api.getLessonVocabularies(lesson.id, targetLevel);
        setVocabList(vocabRes.items || []);
        setIsVocabFallback(!!vocabRes.isFallback);
        setVocabCourseLevel(vocabRes.courseLevel || targetLevel);
      } catch (err) {
        console.error("Failed to load lesson vocabulary", err);
      } finally {
        setVocabLoading(false);
      }

      setKanjiLoading(true);
      try {
        const kanjiRes = await api.getLessonKanjis(lesson.id, targetLevel);
        const chars = (kanjiRes.items || []).map((k) => k.character);
        setKanjiList(chars);
        setIsKanjiFallback(!!kanjiRes.isFallback);
        setKanjiCourseLevel(kanjiRes.courseLevel || targetLevel);
        if (chars.length > 0) {
          setActiveKanji(chars[0]);
        }
      } catch (err) {
        console.error("Failed to load lesson kanjis", err);
      } finally {
        setKanjiLoading(false);
      }
    };

    const loadMicroProgress = async () => {
      if (!lesson.id) return;
      try {
        const summary = await api.getLessonMicroProgress(lesson.id);
        const map: Record<string, boolean> = {};
        if (summary.resourceProgresses) {
          summary.resourceProgresses.forEach((rp) => {
            map[rp.resourceId] = rp.isCompleted;
          });
        }
        setResourceProgressMap(map);
      } catch (err) {
        console.error("Failed to load lesson micro-progress", err);
      }
    };

    loadVocabAndKanji();
    loadMicroProgress();
    setAddingToSrs({});
    setActivePrimaryResId(null);
  }, [lesson.id, course?.jlptLevel]);

  // Toggle Micro Progress for a single Resource (with e.stopPropagation() & e.preventDefault())
  const handleToggleResourceComplete = async (resourceId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const current = !!resourceProgressMap[resourceId];
    const next = !current;

    // Optimistic local state update (immediately updates UI counter and circle/check icon)
    setResourceProgressMap((prev) => ({ ...prev, [resourceId]: next }));

    try {
      const res = await api.toggleResourceComplete(resourceId, next);
      if (res && res.resourceProgress) {
        setResourceProgressMap((prev) => ({
          ...prev,
          [resourceId]: res.resourceProgress.isCompleted,
        }));

        // Composite Sync: Auto-update whole Lesson state if condition changed
        if (res.isLessonCompleted !== isCompleted) {
          onToggleComplete();
        }
      }
    } catch (err) {
      console.error("Failed to toggle resource complete", err);
      // Rollback on error
      setResourceProgressMap((prev) => ({ ...prev, [resourceId]: current }));
    }
  };

  // Auto-play next resource and mark completed when playback finishes
  const handleResourceEnded = async (resourceId: string) => {
    try {
      const res = await api.markResourceComplete(resourceId);
      setResourceProgressMap((prev) => ({ ...prev, [resourceId]: true }));

      // Auto-switch to next resource tab in sequence
      const currentIndex = lesson.resources.findIndex((r) => r.id === resourceId);
      if (currentIndex >= 0 && currentIndex + 1 < lesson.resources.length) {
        const nextRes = lesson.resources[currentIndex + 1];
        setActivePrimaryResId(nextRes.id);
      }

      if (res.isLessonCompleted && !isCompleted) {
        onToggleComplete();
      }
    } catch (err) {
      console.error("Failed to mark resource complete on ended", err);
    }
  };

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

  const completedResourcesCount = lesson.resources.filter((r) => !!resourceProgressMap[r.id]).length;
  const videoResources = lesson.resources.filter((r) => r.resourceType === 0);
  const completedVideosCount = videoResources.filter((r) => !!resourceProgressMap[r.id]).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3 pb-8 bg-[#f8f9ff] dark:bg-[#090d16] transition-colors">
      <div className={`grid grid-cols-1 gap-4 items-start transition-all duration-200 ${
        showSidebar ? "xl:grid-cols-12" : "xl:grid-cols-1"
      }`}>
        {/* Left / Center Main Stage (8 columns or full 12 columns) */}
        <div className={`flex flex-col gap-3.5 min-w-0 ${
          showSidebar ? "xl:col-span-8" : "xl:col-span-12"
        }`}>
          {/* ── Top Sleek Resource Switcher Bar (Playful Bento) ── */}
          {(lesson.resources.length > 0 || (lesson.quizzes && lesson.quizzes.length > 0)) && (
            <div className="bento-card p-1.5 sm:p-2 flex items-center gap-2 shadow-xs">
              {/* Lesson Resource Progress Badge */}
              {lesson.resources.length > 0 && (
                <div 
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-black select-none"
                  title={`Đã hoàn thành ${completedResourcesCount} trên ${lesson.resources.length} tài nguyên`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Tiến độ: {completedResourcesCount}/{lesson.resources.length}</span>
                </div>
              )}

              {/* Left Scroll Navigation Button */}
              {lesson.resources.length > 1 && (
                <button
                  type="button"
                  onClick={() => scrollTabs("left")}
                  className="shrink-0 p-1.5 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all active:scale-90 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs cursor-pointer"
                  title="Cuộn sang trái (‹)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Horizontal Scrollable Tabs Container */}
              <div
                ref={tabsContainerRef}
                onWheel={handleTabsWheel}
                className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 px-0.5 scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {lesson.resources.map((res) => {
                  const isSelected = currentPrimaryResource?.id === res.id;
                  const isResCompleted = !!resourceProgressMap[res.id];

                  return (
                    <div
                      key={res.id}
                      ref={(el) => {
                        tabItemRefs.current[res.id] = el;
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActivePrimaryResId(res.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActivePrimaryResId(res.id);
                        }
                      }}
                      className={`group/tab relative flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer select-none active:scale-[0.98] ${
                        isSelected
                          ? "bg-emerald-500 text-white shadow-[0_3px_0_#059669] opacity-100"
                          : isResCompleted
                          ? "bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-[0_2px_0_#a7f3d0] dark:shadow-[0_2px_0_#064e3b]"
                          : "bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-[#0b1c30] dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
                      }`}
                    >
                      {/* Type Icon */}
                      {res.resourceType === 0 ? (
                        <PlayCircle
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? "text-white"
                              : isResCompleted
                              ? "text-emerald-500"
                              : "text-orange-500"
                          }`}
                        />
                      ) : res.resourceType === 1 ? (
                        <Headphones
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? "text-white"
                              : isResCompleted
                              ? "text-emerald-500"
                              : "text-sky-500"
                          }`}
                        />
                      ) : (
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? "text-white"
                              : isResCompleted
                              ? "text-emerald-500"
                              : "text-rose-500"
                          }`}
                        />
                      )}

                      {/* Title */}
                      <span className="truncate max-w-[200px]">{res.title}</span>

                      {/* Discrete Clickable Checkmark Icon */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleResourceComplete(res.id, e)}
                        className={`ml-0.5 p-0.5 rounded-full transition-all active:scale-90 cursor-pointer ${
                          isSelected
                            ? "hover:bg-white/20 text-white"
                            : isResCompleted
                            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200/50"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                        title={
                          isResCompleted
                            ? "Đã xem xong - Bấm để hủy hoàn thành"
                            : "Chưa xem - Bấm để đánh dấu hoàn thành"
                        }
                      >
                        {isResCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Circle className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Assigned Quizzes Pills */}
                {lesson.quizzes &&
                  lesson.quizzes.map((q) => (
                    <button
                      key={q.id}
                      onClick={onLaunchQuiz}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-[0_2px_0_#ddd6fe] dark:shadow-[0_2px_0_#581c87] hover:bg-purple-100 active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="truncate max-w-[200px]">
                        Đề Thi: {q.title} ({q.questionCount} câu)
                      </span>
                    </button>
                  ))}
              </div>

              {/* Right Scroll Navigation Button */}
              {lesson.resources.length > 1 && (
                <button
                  type="button"
                  onClick={() => scrollTabs("right")}
                  className="shrink-0 p-1.5 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all active:scale-90 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs cursor-pointer"
                  title="Cuộn sang phải (›)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
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
            resourceId={currentPrimaryResource.id}
            isCompleted={!!resourceProgressMap[currentPrimaryResource.id]}
            onToggleComplete={() => handleToggleResourceComplete(currentPrimaryResource.id)}
            onVideoEnded={() => handleResourceEnded(currentPrimaryResource.id)}
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
        <div className="bento-card p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/10 animate-bounce">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold text-xs border border-amber-500/30 uppercase tracking-wide">
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
            className="btn-tactile-amber px-8 py-3.5 text-sm font-black flex items-center gap-2.5 cursor-pointer"
          >
            <span>Bắt Đầu Làm Bài Ngay</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Empty resource placeholder */
        <div className="bento-card w-full h-64 flex flex-col items-center justify-center text-slate-400 gap-3 p-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-center text-slate-500 dark:text-slate-400">Bài học này chưa có tệp đa phương tiện đính kèm.</p>
        </div>
      )}

      {/* ── Sub-Video Quick Action & Lesson Status Bar (Clean Bento Strip) ── */}
      <div className="bento-card px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-black text-[#0b1c30] dark:text-white tracking-tight truncate">
            Đang học: {lesson.title}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Mark as Completed Button */}
          <button
            type="button"
            onClick={onToggleComplete}
            className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isCompleted
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                : "bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0b1c30] dark:bg-slate-800 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs"
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isCompleted ? "text-emerald-600" : "text-slate-500"}`} />
            <span>{isCompleted ? "Đã xong ✓" : "Đánh dấu hoàn thành"}</span>
          </button>

          {/* Next Lesson Button */}
          {hasNextLesson && onNextLesson && (
            <button
              type="button"
              onClick={() => {
                if (!isCompleted) onToggleComplete();
                onNextLesson();
              }}
              className="bg-[#0b1c30] hover:bg-[#1a2e47] text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 sm:px-5 py-2 rounded-full text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <span>{isCompleted ? "Bài tiếp theo" : "Xong & Sang bài tiếp"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Prep / Riki Style Content Navigation Tabs */}
      <div className="flex flex-col gap-4">
        {/* Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("vocab")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "vocab"
                ? "bg-emerald-500 text-white shadow-[0_3px_0_#059669]"
                : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff] shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📚 Từ Vựng {vocabLoading ? "(…)" : `(${vocabList.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "notes"
                ? "bg-purple-600 text-white shadow-[0_3px_0_#6d28d9]"
                : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff] shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>📝 Ngữ Pháp</span>
          </button>

          <button
            onClick={() => setActiveTab("audio")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "audio"
                ? "bg-sky-500 text-white shadow-[0_3px_0_#0284c7]"
                : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff] shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
            }`}
          >
            <FileAudio className="w-4 h-4" />
            <span>🎧 Luyện Nghe ({audioResources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("pdf")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "pdf"
                ? "bg-rose-500 text-white shadow-[0_3px_0_#be123c]"
                : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff] shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>📄 Tài Liệu ({pdfResources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "quiz"
                ? "bg-amber-500 text-white shadow-[0_3px_0_#c2410c]"
                : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff] shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>✍️ Quiz</span>
          </button>

          <button
            onClick={() => setActiveTab("kanji")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "kanji"
                ? "bg-indigo-600 text-white shadow-[0_3px_0_#4338ca]"
                : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff] shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
            }`}
          >
            <BrainCircuit className="w-4 h-4" />
            <span>🎌 Luyện Viết Kanji {kanjiLoading ? "(…)" : `(${kanjiList.length})`}</span>
          </button>
        </div>

        {/* Tab Panes Container */}
        <div className="bento-card p-6 min-h-[320px]">

          {/* ── TAB 1: VOCABULARY ── */}
          {activeTab === "vocab" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Bộ Từ Vựng — {lesson.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Favorites Filter Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setVocabFilter("all")}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        vocabFilter === "all"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Tất Cả ({vocabList.length})
                    </button>
                    <button
                      onClick={() => setVocabFilter("fav")}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 hover:bg-[#dce9ff] dark:hover:bg-slate-700 text-[#0b1c30] dark:text-slate-300 text-xs font-bold transition-all border border-[#d3e4fe] dark:border-slate-700 shadow-2xs cursor-pointer"
                  >
                    {showFurigana ? <EyeOff className="w-3.5 h-3.5 text-orange-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
                    {showFurigana ? "Ẩn Furigana" : "Hiện Furigana"}
                  </button>
                </div>
              </div>

              {/* JLPT Fallback Notification Banner */}
              {isVocabFallback && vocabList.length > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>💡 Gợi ý {vocabList.length} từ ôn luyện ngẫu nhiên theo JLPT {vocabCourseLevel || course?.jlptLevel || "N3"}</span>
                </div>
              )}

              {/* Loading state */}
              {vocabLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>Đang tải từ vựng...</span>
                </div>
              ) : vocabList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 text-slate-400">
                  <BookOpen className="w-8 h-8 opacity-40" />
                  <p className="text-xs font-medium">Chưa có từ vựng nào cho bài học này.</p>
                  <p className="text-[11px] text-slate-400">Thêm từ vựng trong Admin → Từ Vựng CMS.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {vocabList
                    .filter((item) => (vocabFilter === "all" || isVocabFavorite(item.id)))
                    .map((item) => {
                    const srsStatus = addingToSrs[item.id] || "idle";
                    const kanjiChar = extractKanji(item.word);
                    const isFav = isVocabFavorite(item.id);

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col gap-2.5 group"
                      >
                        {/* Word + reading + POS + SRS button */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            {showFurigana && item.reading !== item.word ? (
                              <ruby className="text-xl font-black text-slate-900 dark:text-white">
                                {item.word}
                                <rt className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{item.reading}</rt>
                              </ruby>
                            ) : (
                              <span className="text-xl font-black text-slate-900 dark:text-white">{item.word}</span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                              {item.jlptLevel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Star Favorite button */}
                            <button
                              onClick={() => toggleVocabFavorite(item.id)}
                              title={isFav ? "Bỏ khỏi danh sách yêu thích" : "Lưu vào từ vựng yêu thích"}
                              className={`p-2 rounded-full text-xs transition-all border cursor-pointer ${
                                isFav
                                  ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                  : "bg-[#eff4ff] dark:bg-slate-800 border-[#d3e4fe] dark:border-slate-700 text-slate-400 hover:text-amber-500"
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-500 text-amber-500" : ""}`} />
                            </button>

                            {/* KanjiCanvas toggle */}
                            {kanjiChar && (
                              <button
                                onClick={() => toggleKanjiCanvas(item.id)}
                                title="Xem thứ tự nét Kanji"
                                className={`p-2 rounded-full text-xs transition-all border cursor-pointer ${
                                  showKanji[item.id]
                                    ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400"
                                    : "bg-[#eff4ff] dark:bg-slate-800 border-[#d3e4fe] dark:border-slate-700 text-slate-400 hover:text-indigo-500"
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
                              className={`p-2 rounded-full text-xs transition-all border cursor-pointer ${
                                srsStatus === "done"
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600"
                                  : srsStatus === "loading"
                                  ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300"
                                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
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
                        <span className="self-start px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
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
                          <div className="bg-[#f8f9ff] dark:bg-slate-900 p-3 rounded-xl border border-[#eff4ff] dark:border-slate-800 text-xs mt-1">
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
                <Lightbulb className="w-4 h-4 text-purple-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Cấu Trúc Ngữ Pháp Trọng Tâm</h3>
              </div>

              <div className="p-5 rounded-2xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/20 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-purple-600 text-white font-black text-[10px] shadow-xs">Cấu trúc 1</span>
                  <span className="text-xs font-black text-purple-700 dark:text-purple-300">Khẳng định: N1 は N2 です</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Trợ từ <span className="font-bold text-orange-500">は (wa)</span> đứng sau chủ ngữ N1. <span className="font-bold text-purple-600">です (desu)</span> cuối câu biểu thị lịch sự.
                </p>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-purple-100 dark:border-slate-800 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Ví dụ: わたし は マイク・ミラー です。</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">→ Tôi là Mike Miller.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-indigo-600 text-white font-black text-[10px] shadow-xs">Cấu trúc 2</span>
                  <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">Phủ định: N1 は N2 じゃありません</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Dạng phủ định: <span className="font-bold text-rose-500">じゃありません</span> hoặc <span className="font-bold text-rose-400">ではありません</span>.
                </p>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Ví dụ: サントスさん は 学生 じゃありません。</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">→ Anh Santos không phải là sinh viên.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: AUDIO PLAYLIST ───────────────────────────────────────── */}
          {activeTab === "audio" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-sky-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Danh Sách Audio Luyện Nghe ({audioResources.length} bài)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Bấm để chọn track phát trên trình phát chính</span>
              </div>

              {audioResources.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
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
                            ? "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 shadow-sm ring-2 ring-sky-500/30"
                            : "bg-[#f8f9ff] dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 hover:border-sky-400 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent ? "bg-sky-500 text-white shadow-[0_2px_0_#0284c7]" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
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
                            <span className="px-3 py-1 rounded-full bg-sky-500 text-white text-[11px] font-bold shadow-xs">
                              🎵 Đang Phát
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActivePrimaryResId(audio.id); }}
                              className="px-3.5 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-sky-500 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
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
                              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl">Chưa gắn tài liệu PDF cho bài học này.</div>
              ) : (
                pdfResources.map((pdf) => (
                  <div key={pdf.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{pdf.title}</span>
                    {pdf.driveFileId && (
                      <a
                        href={`https://drive.google.com/file/d/${pdf.driveFileId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-tactile-amber px-4 py-1.5 text-xs font-bold flex items-center gap-1.5"
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
            <div className="flex flex-col gap-4 items-center justify-center p-8 text-center bg-purple-50/40 dark:bg-purple-950/20 rounded-3xl border border-purple-200 dark:border-purple-800">
              <div className="w-14 h-14 rounded-3xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 mb-1">
                <HelpCircle className="w-7 h-7" />
              </div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Bài Tập Tự Luyện</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Kiểm tra kiến thức từ vựng và ngữ pháp vừa học để củng cố bài học và lưu tiến độ tự động.
              </p>
              <button
                onClick={onLaunchQuiz}
                className="btn-tactile-purple mt-2 px-6 py-3 text-xs font-black flex items-center gap-2 cursor-pointer"
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

              {/* JLPT Fallback Notification Banner */}
              {isKanjiFallback && kanjiList.length > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-bold">
                  <BrainCircuit className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>💡 Gợi ý {kanjiList.length} chữ Hán ôn luyện ngẫu nhiên theo JLPT {kanjiCourseLevel || course?.jlptLevel || "N3"}</span>
                </div>
              )}

              {/* Loading state */}
              {kanjiLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Đang tải chữ Hán...</span>
                </div>
              ) : kanjiList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 text-slate-400">
                  <BrainCircuit className="w-8 h-8 opacity-40" />
                  <p className="text-xs font-medium">Chưa có chữ Hán nào cho bài học này.</p>
                </div>
              ) : (
                <>
                  {/* Kanji Selector Chips (Tactile Playful Bento) */}
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                    <span className="text-xs font-bold text-slate-500 shrink-0">Chọn chữ tập viết:</span>
                    {kanjiList.map((k) => (
                      <button
                        key={k}
                        onClick={() => setActiveKanji(k)}
                        className={`w-11 h-11 rounded-2xl font-black text-lg flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          activeKanji === k
                            ? "bg-emerald-500 text-white shadow-[0_4px_0_#059669] scale-105"
                            : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 shadow-[0_3px_0_#d3e4fe] dark:shadow-[0_3px_0_#1e293b] hover:bg-[#dce9ff]"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>

                  {/* Kanji Canvas Component */}
                  <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-[#f8f9ff] dark:bg-slate-800/40 border border-[#eff4ff] dark:border-slate-700/80 shadow-inner">
                    <KanjiCanvas kanji={activeKanji || kanjiList[0] || "私"} size={260} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Right Column: Course Curriculum Card & AI Sensei Widget (4 columns on XL screens when visible) */}
    {showSidebar && (
      <div className="xl:col-span-4 flex flex-col gap-6 min-w-0 xl:sticky xl:top-0 transition-all duration-200">
        {course && (
          <CourseCurriculumCard
            course={course}
            activeLessonId={lesson.id}
            completedLessonIds={completedLessonIds}
            onSelectLesson={(l, c, s) => {
              if (onSelectLesson) onSelectLesson(l, c, s);
            }}
            onToggleCollapse={toggleSidebar}
          />
        )}

        <AiSenseiWidget
          lesson={lesson}
          courseTitle={courseTitle}
          sectionTitle={sectionTitle}
          jlptLevel={course?.jlptLevel || "N3"}
        />
      </div>
    )}

    {/* Floating Button to Re-Open Curriculum & AI Sidebar when collapsed */}
    {!showSidebar && (
      <button
        type="button"
        onClick={toggleSidebar}
        className="fixed right-5 bottom-6 z-40 bg-[#0b1c30] hover:bg-[#1a2e47] text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2.5 rounded-full text-xs font-black flex items-center gap-2 shadow-xl border border-slate-700/50 cursor-pointer animate-in fade-in active:scale-95"
        title="Mở mục lục khóa học & AI Sensei"
      >
        <PanelRightOpen className="w-4 h-4 text-emerald-400 dark:text-white" />
        <span>Mục lục & AI</span>
      </button>
    )}
  </div>
</div>
  );
};
