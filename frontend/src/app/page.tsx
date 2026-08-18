"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LearnerSidebar } from "@/components/learner/LearnerSidebar";
import { LessonContentView } from "@/components/learner/LessonContentView";
import { SrsFlashcardModal } from "@/components/learner/SrsFlashcardModal";
import { QuizModal } from "@/components/learner/QuizModal";
import { Course, Section, Lesson, api } from "@/lib/api";
import Link from "next/link";
import {
  BookOpen, Flame, Sparkles, Target, TrendingUp, ChevronRight,
  Clock, CheckCircle2, GraduationCap
} from "lucide-react";

export default function LearnerPortalPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const [completedLessonIds, setCompletedLessonIds] = useState<Record<string, boolean>>({});

  // Modals
  const [showSrsModal, setShowSrsModal] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  // Dashboard stats
  const [srsStats, setSrsStats] = useState<{ dueToday: number; newToday: number; reviewedToday: number; streak: number }>({
    dueToday: 0,
    newToday: 0,
    reviewedToday: 0,
    streak: 0,
  });

  useEffect(() => {
    const handleOpenSrs = () => setShowSrsModal(true);
    window.addEventListener("open-srs-modal", handleOpenSrs);

    // Load completion state from localStorage
    const savedCompletions = localStorage.getItem("nihongo_completed_lessons");
    if (savedCompletions) {
      try { setCompletedLessonIds(JSON.parse(savedCompletions)); } catch {}
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [data, stats] = await Promise.all([
          api.getCourses(),
          api.getSrsStats(),
        ]);
        setCourses(data);
        setSrsStats(stats as any);

        if (data.length > 0 && data[0].sections.length > 0 && data[0].sections[0].lessons.length > 0) {
          setActiveCourse(data[0]);
          setActiveSection(data[0].sections[0]);
          setActiveLesson(data[0].sections[0].lessons[0]);
        }
      } catch (err) {
        console.error("Failed to load learner data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    return () => window.removeEventListener("open-srs-modal", handleOpenSrs);
  }, []);

  const totalLessons = courses.reduce((s, c) => s + c.sections.reduce((ss, sec) => ss + sec.lessons.length, 0), 0);
  const completedCount = Object.values(completedLessonIds).filter(Boolean).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const handleSelectLesson = (lesson: Lesson, course: Course, section: Section) => {
    setActiveCourse(course);
    setActiveSection(section);
    setActiveLesson(lesson);
  };

  const handleToggleComplete = () => {
    if (!activeLesson) return;
    const nextState = !completedLessonIds[activeLesson.id];
    const updated = { ...completedLessonIds, [activeLesson.id]: nextState };
    setCompletedLessonIds(updated);
    localStorage.setItem("nihongo_completed_lessons", JSON.stringify(updated));
  };

  const handleLaunchQuiz = async () => {
    if (!activeLesson) return;
    try {
      const quizzes = await api.getQuizzes(activeLesson.id);
      if (quizzes.length > 0) {
        setActiveQuizId(quizzes[0].id);
      } else {
        alert("Chưa có quiz cho bài học này. Tạo quiz trong Admin → Quiz CMS!");
      }
    } catch {}
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header srsStats={srsStats} />

      {/* ── Dashboard Stats Bar (visible when no lesson selected) ── */}
      {!activeLesson && !loading && (
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
            {/* Welcome */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-orange-500" />
                  Chào Mừng Trở Lại! 🎌
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Tiếp tục hành trình học tiếng Nhật của bạn hôm nay.</p>
              </div>
              <Link
                href="/quiz/mock"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-all shadow-md shadow-orange-500/20"
              >
                <Target className="w-3.5 h-3.5" />
                Luyện Đề JLPT
              </Link>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Streak */}
              <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-orange-500">
                  <Flame className="w-4 h-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Streak</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{srsStats.streak}<span className="text-sm font-bold text-slate-400 ml-1">ngày</span></p>
              </div>

              {/* SRS due */}
              <div
                className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1 cursor-pointer hover:border-amber-500/50 transition-colors"
                onClick={() => setShowSrsModal(true)}
              >
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Ôn Từ Vựng</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{srsStats.dueToday}<span className="text-sm font-bold text-slate-400 ml-1">thẻ</span></p>
              </div>

              {/* Progress */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Hoàn Thành</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{completedCount}<span className="text-sm font-bold text-slate-400 ml-1">/ {totalLessons} bài</span></p>
                {totalLessons > 0 && (
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                )}
              </div>

              {/* Reviewed today */}
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Đã Ôn Hôm Nay</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{srsStats.reviewedToday}<span className="text-sm font-bold text-slate-400 ml-1">từ</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Collapsible Left Sidebar */}
        <LearnerSidebar
          courses={courses}
          activeLessonId={activeLesson?.id}
          onSelectLesson={handleSelectLesson}
          completedLessonIds={completedLessonIds}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                Đang tải nội dung khóa học...
              </div>
            </div>
          ) : activeLesson && activeCourse && activeSection ? (
            <LessonContentView
              lesson={activeLesson}
              courseTitle={activeCourse.title}
              sectionTitle={activeSection.title}
              isCompleted={!!completedLessonIds[activeLesson.id]}
              onToggleComplete={handleToggleComplete}
              onLaunchQuiz={handleLaunchQuiz}
            />
          ) : (
            /* Empty state — shown before any lesson is selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 overflow-y-auto">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-black text-lg text-slate-900 dark:text-white">Chọn Bài Học Để Bắt Đầu</h2>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Chọn một bài học trong danh sách bên trái để bắt đầu xem nội dung, từ vựng và luyện quiz.
                </p>
              </div>
              {courses.length === 0 && (
                <Link
                  href="/admin/builder"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-all"
                >
                  Tạo Khóa Học Đầu Tiên <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showSrsModal && <SrsFlashcardModal onClose={() => setShowSrsModal(false)} />}
      {activeQuizId && (
        <QuizModal
          quizId={activeQuizId}
          onClose={() => setActiveQuizId(null)}
          onSuccess={() => {
            if (activeLesson) {
              const updated = { ...completedLessonIds, [activeLesson.id]: true };
              setCompletedLessonIds(updated);
              localStorage.setItem("nihongo_completed_lessons", JSON.stringify(updated));
            }
          }}
        />
      )}
    </div>
  );
}
