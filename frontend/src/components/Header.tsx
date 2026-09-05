"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { api, isBackendConnected, WeeklyPacing } from "@/lib/api";
import { SrsFlashcardModal } from "@/components/learner/SrsFlashcardModal";
import { UserSettingsModal } from "@/components/learner/UserSettingsModal";
import {
  Moon, Sun, Languages, BookOpen, Layers, CheckCircle2,
  HelpCircle, Sparkles, Server, Zap, Target, Flame, Settings, KeyRound,
  CalendarCheck2, ChevronDown
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
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [showSrsModal, setShowSrsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [connected, setConnected] = useState(false);
  const [weeklyPacing, setWeeklyPacing] = useState<WeeklyPacing | null>(null);
  const [showPacingMenu, setShowPacingMenu] = useState(false);

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
        // demo / fallback
      }
    };
    loadPacing();

    const handleOpenSrs = () => setShowSrsModal(true);
    window.addEventListener("open-srs-modal", handleOpenSrs);
    return () => window.removeEventListener("open-srs-modal", handleOpenSrs);
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

            <Link
              href="/roadmap"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname?.startsWith("/roadmap")
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              Lộ trình
            </Link>

            <Link
              href="/admin/settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pathname === "/admin/settings"
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-orange-500" />
              Cài Đặt AI
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Streak indicator */}
            {srsStats && srsStats.streak > 0 && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-extrabold bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 shrink-0">
                <Flame className="w-3 h-3 shrink-0" />
                {srsStats.streak}d
              </div>
            )}

            {/* Weekly Pacing Widget */}
            {weeklyPacing && (
              <div className="relative">
                {(() => {
                  const isGoalMet = weeklyPacing.completedLessonsThisWeek >= weeklyPacing.targetLessonsPerWeek;
                  return (
                    <button
                      onClick={() => setShowPacingMenu(!showPacingMenu)}
                      className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isGoalMet
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                      title={`Mục tiêu tuần: ${weeklyPacing.completedLessonsThisWeek}/${weeklyPacing.targetLessonsPerWeek} bài`}
                    >
                      <CalendarCheck2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>
                        Tuần này: <b className={isGoalMet ? "text-emerald-500" : "text-orange-500"}>{weeklyPacing.completedLessonsThisWeek}</b>/{weeklyPacing.targetLessonsPerWeek}
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                    </button>
                  );
                })()}

                {showPacingMenu && (
                  <div className="absolute right-0 mt-2 w-56 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95">
                    <p className="text-[11px] font-extrabold uppercase text-slate-400 mb-2">🎯 Mục tiêu học tuần</p>
                    <div className="grid grid-cols-4 gap-1 mb-2">
                      {[1, 2, 3, 4, 5, 7, 10].map((num) => (
                        <button
                          key={num}
                          onClick={() => handleSetWeeklyGoal(num)}
                          className={`py-1 text-xs font-bold rounded-lg transition-all ${
                            weeklyPacing.targetLessonsPerWeek === num
                              ? "bg-orange-600 text-white shadow-sm"
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
            )}

            {/* Server Status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl text-[10px] font-extrabold border shrink-0 ${
                connected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
              title={connected ? "API connected at localhost:5222" : "Demo Mode — Start .NET API on port 5222"}
            >
              {connected ? <Server className="w-3 h-3 text-emerald-500 shrink-0" /> : <Zap className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />}
              <span>{connected ? "API Live" : "Demo"}</span>
            </div>

            {/* SRS Flashcard Button - Global across all pages */}
            <button
              onClick={() => setShowSrsModal(true)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-orange-700 dark:text-orange-300 hover:bg-orange-500/25 border border-orange-500/30 transition-all active:scale-95 shrink-0"
              title="Ôn Thẻ Từ Vựng Thông Minh SRS (Anki)"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="hidden sm:inline">Ôn SRS</span>
              {srsDueCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center px-1 shadow-sm shrink-0">
                  {srsDueCount > 99 ? "99+" : srsDueCount}
                </span>
              )}
            </button>

            {/* Settings (Watch Time & Resume Prompts) */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
              title="Cài đặt học tập (Theo dõi xem video & Thông báo)"
            >
              <Settings className="w-4 h-4 text-orange-500" />
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "en" ? "vi" : "en")}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
            >
              <Languages className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="uppercase">{lang}</span>
            </button>

            {/* Dark/Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
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

