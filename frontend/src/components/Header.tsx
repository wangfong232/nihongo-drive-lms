"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useCourseLevel } from "@/lib/courseLevel";
import { api, isBackendConnected, WeeklyPacing } from "@/lib/api";
import { SrsFlashcardModal } from "@/components/learner/SrsFlashcardModal";
import { UserSettingsModal } from "@/components/learner/UserSettingsModal";
import {
  BookOpen, Layers, CheckCircle2, HelpCircle, Sparkles, Server, Zap,
  Flame, Settings, ChevronDown, Check, GraduationCap
} from "lucide-react";

interface HeaderProps {
  srsStats?: {
    dueToday: number;
    newToday: number;
    reviewedToday: number;
    streak: number;
  };
}

export const Header: React.FC<HeaderProps> = ({ srsStats }) => {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const { selectedLevel, setSelectedLevel, availableLevels } = useCourseLevel();
  const [showSrsModal, setShowSrsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [connected, setConnected] = useState(false);
  const [weeklyPacing, setWeeklyPacing] = useState<WeeklyPacing | null>(null);

  // Popover menus
  const [showPacingMenu, setShowPacingMenu] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showDotStatusMenu, setShowDotStatusMenu] = useState(false);

  const rightActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        await api.getAuthStatus();
        setConnected(isBackendConnected);
      } catch {
        setConnected(false);
      }
    };
    checkServer();

    const loadPacing = async () => {
      try {
        const pacing = await api.getWeeklyPacing();
        setWeeklyPacing(pacing);
      } catch {
        // fallback demo
        setWeeklyPacing({
          targetLessonsPerWeek: 4,
          completedLessonsThisWeek: 3,
          percentage: 75,
          weekStartDateUtc: new Date().toISOString(),
          weekEndDateUtc: new Date().toISOString(),
          statusMessage: "Mục tiêu 4 bài/tuần",
        });
      }
    };
    loadPacing();

    const handleOpenSrs = () => setShowSrsModal(true);
    window.addEventListener("open-srs-modal", handleOpenSrs);

    // Close popovers on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (rightActionsRef.current && !rightActionsRef.current.contains(e.target as Node)) {
        setShowPacingMenu(false);
        setShowLevelMenu(false);
        setShowDotStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("open-srs-modal", handleOpenSrs);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSetWeeklyGoal = async (target: number) => {
    try {
      const res = await api.setWeeklyGoal(target);
      setWeeklyPacing((prev) => prev ? { ...prev, targetLessonsPerWeek: res.targetLessonsPerWeek } : null);
      setShowPacingMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  const srsDueCount = srsStats?.dueToday ?? 0;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors h-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25 group-hover:scale-105 transition-all duration-300 shrink-0">
              <span className="font-black text-base">日</span>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                  Drive<span className="text-orange-600 dark:text-orange-500">Learn</span>
                </span>
              </div>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Self-Hosted Japanese Platform
              </span>
            </div>
          </Link>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shrink-0">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname === "/"
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              {t("navCourses")}
            </Link>

            <Link
              href="/admin/builder"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname?.startsWith("/admin/builder")
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              {t("navAdmin")}
            </Link>

            <Link
              href="/admin/vocabulary"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname === "/admin/vocabulary"
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {t("navVocabulary")}
            </Link>

            <Link
              href="/kanji"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname?.startsWith("/kanji")
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="text-orange-500 font-black text-xs">漢</span>
              {t("navKanji")}
            </Link>

            <Link
              href="/admin/quizzes"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname === "/admin/quizzes"
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              {t("navQuizzes")}
            </Link>
          </nav>

          {/* Right Actions — Pill Controls (Image 2 style) */}
          <div ref={rightActionsRef} className="flex items-center gap-2 shrink-0">

            {/* 1. Three-dot Status Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowDotStatusMenu(!showDotStatusMenu);
                  setShowPacingMenu(false);
                  setShowLevelMenu(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 shadow-xs hover:border-orange-500/50 hover:shadow-sm transition-all"
                title="Tổng quan trạng thái học tập"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              </button>

              {showDotStatusMenu && (
                <div className="absolute right-0 mt-2 w-64 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-black uppercase text-slate-400">Trạng Thái Hệ Thống</span>
                    <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  </div>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Khóa Đang Học:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedLevel === "ALL" ? "Tất Cả" : `JLPT ${selectedLevel}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-500" /> Tiến Độ Tuần:
                      </span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {weeklyPacing ? `${weeklyPacing.completedLessonsThisWeek}/${weeklyPacing.targetLessonsPerWeek} bài` : "Chưa đặt"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" /> Thẻ SRS Cần Ôn:
                      </span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {srsDueCount} thẻ
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Peach Weekly Lessons Pacing Pill (🔥 3/4 lessons this week) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPacingMenu(!showPacingMenu);
                  setShowLevelMenu(false);
                  setShowDotStatusMenu(false);
                }}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#fed7aa]/60 hover:bg-[#fed7aa]/90 dark:bg-[#7c2d12]/30 dark:hover:bg-[#7c2d12]/50 border border-[#fdba74]/60 dark:border-[#9a3412]/40 text-[#7c2d12] dark:text-[#fed7aa] text-xs font-bold shadow-xs transition-all active:scale-95"
                title="Mục tiêu bài học tuần này"
              >
                <Flame className="w-4 h-4 text-[#c2410c] dark:text-[#fb923c] shrink-0" />
                <span className="whitespace-nowrap">
                  {weeklyPacing ? `${weeklyPacing.completedLessonsThisWeek}/${weeklyPacing.targetLessonsPerWeek}` : "3/4"}{" "}
                  <span className="font-medium text-[11px] opacity-90">
                    {lang === "en" ? "lessons this week" : "bài tuần này"}
                  </span>
                </span>
              </button>

              {showPacingMenu && weeklyPacing && (
                <div className="absolute right-0 mt-2 w-56 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <p className="text-[11px] font-extrabold uppercase text-slate-400 mb-2">🎯 Đặt mục tiêu học tuần</p>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[1, 2, 3, 4, 5, 7, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSetWeeklyGoal(num)}
                        className={`py-1 text-xs font-bold rounded-lg transition-all ${
                          weeklyPacing.targetLessonsPerWeek === num
                            ? "bg-orange-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {num} bài
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Đã hoàn thành {weeklyPacing.completedLessonsThisWeek} bài trong tuần hiện tại.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Mint Green JLPT Course Level Selector Pill (✓ JLPT N5) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowLevelMenu(!showLevelMenu);
                  setShowPacingMenu(false);
                  setShowDotStatusMenu(false);
                }}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#86efac]/80 hover:bg-[#86efac] dark:bg-[#065f46]/50 dark:hover:bg-[#065f46]/70 border border-[#4ade80]/70 dark:border-[#047857]/60 text-[#14532d] dark:text-[#a7f3d0] text-xs font-bold shadow-xs transition-all active:scale-95"
                title="Chọn khóa học & trình độ JLPT"
              >
                <CheckCircle2 className="w-4 h-4 text-[#15803d] dark:text-[#4ade80] shrink-0" />
                <span className="whitespace-nowrap">
                  {selectedLevel === "ALL" ? (lang === "en" ? "All Levels" : "Tất Cả Khóa") : `JLPT ${selectedLevel}`}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0 ml-0.5" />
              </button>

              {showLevelMenu && (
                <div className="absolute right-0 mt-2 w-56 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Chọn Trình Độ Khóa Học
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {availableLevels.map((lvl) => {
                      const isSelected = selectedLevel === lvl.code;
                      return (
                        <button
                          key={lvl.code}
                          type="button"
                          onClick={() => {
                            setSelectedLevel(lvl.code);
                            setShowLevelMenu(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                            isSelected
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div>
                            <span className="block font-bold">{lvl.label}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">{lvl.description}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 4. SRS Flashcard Button */}
            <button
              type="button"
              onClick={() => setShowSrsModal(true)}
              className="relative hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 transition-all active:scale-95 shrink-0"
              title="Ôn Thẻ Từ Vựng Thông Minh SRS (Anki)"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Ôn SRS</span>
              {srsDueCount > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center px-1 shadow-xs shrink-0">
                  {srsDueCount > 99 ? "99+" : srsDueCount}
                </span>
              )}
            </button>

            {/* 5. Settings Gear (Opens UserSettingsModal containing all preferences) */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
              title="Cài đặt hệ thống, giao diện & học tập"
            >
              <Settings className="w-4 h-4 text-orange-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {/* Global SRS Flashcard Modal */}
      {showSrsModal && (
        <SrsFlashcardModal onClose={() => setShowSrsModal(false)} />
      )}

      {/* Global Learning Settings Modal */}
      <UserSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
};

