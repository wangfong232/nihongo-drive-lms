"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Course, Section, Lesson } from "@/lib/api";
import {
  ChevronDown, ChevronRight, FolderKanban, Play, Check,
  Search, X, PlayCircle, FileText, PanelRightClose
} from "lucide-react";

interface CourseCurriculumCardProps {
  course: Course;
  activeLessonId?: string;
  completedLessonIds?: Record<string, boolean>;
  onSelectLesson: (lesson: Lesson, course: Course, section: Section) => void;
  onToggleCollapse?: () => void;
}

export const CourseCurriculumCard: React.FC<CourseCurriculumCardProps> = ({
  course,
  activeLessonId,
  completedLessonIds = {},
  onSelectLesson,
  onToggleCollapse,
}) => {
  // Collapsed state for sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Helper to format lesson title without duplicate prefix
  const formatLessonTitle = (title: string, index: number) => {
    const trimmed = (title || "").trim();
    if (/^(chương|bài|lesson|unit|phần|stage|chặng)\s*\d+/i.test(trimmed)) {
      return trimmed;
    }
    return `Chương ${index}: ${trimmed}`;
  };

  // Auto-expand the section containing the active lesson
  useEffect(() => {
    if (!activeLessonId || !course.sections) return;
    const activeSection = course.sections.find((sec) =>
      sec.lessons.some((l) => l.id === activeLessonId)
    );
    if (activeSection) {
      setCollapsedSections((prev) => ({
        ...prev,
        [activeSection.id]: false,
      }));
    }
  }, [activeLessonId, course]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Calculate overall course progress
  const allFlattenedLessons = useMemo(() => {
    const list: { lesson: Lesson; section: Section; index: number }[] = [];
    let idx = 0;
    course.sections?.forEach((sec) => {
      sec.lessons?.forEach((les) => {
        idx++;
        list.push({ lesson: les, section: sec, index: idx });
      });
    });
    return list;
  }, [course]);

  const totalLessons = allFlattenedLessons.length;
  const completedCount = allFlattenedLessons.filter(
    (item) => completedLessonIds[item.lesson.id]
  ).length;

  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Global lesson index map for clean "Chương X" labeling
  const lessonIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    allFlattenedLessons.forEach((item) => {
      map.set(item.lesson.id, item.index);
    });
    return map;
  }, [allFlattenedLessons]);

  // Filter sections and lessons by search query
  const filteredSections = useMemo(() => {
    if (!course.sections) return [];
    if (!searchQuery.trim()) return course.sections;

    const query = searchQuery.toLowerCase().trim();
    return course.sections
      .map((section) => {
        const matchesSection = section.title.toLowerCase().includes(query);
        const matchingLessons = section.lessons.filter(
          (l) => l.title.toLowerCase().includes(query) || `${lessonIndexMap.get(l.id)}`.includes(query)
        );

        if (matchesSection) return section;
        if (matchingLessons.length > 0) {
          return {
            ...section,
            lessons: matchingLessons,
          };
        }
        return null;
      })
      .filter((s): s is Section => s !== null);
  }, [course.sections, searchQuery, lessonIndexMap]);

  return (
    <div className="bento-card p-5 sm:p-6 flex flex-col gap-3.5 shadow-sm transition-all">
      {/* ── 1. Card Header with Eyebrow Tag, Circular Progress Ring & Collapse Toggle ── */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <span className="px-2.5 py-0.5 rounded-lg bg-[#f97316]/10 text-[#f97316] text-[10px] font-black uppercase tracking-wider inline-block mb-1">
            GIÁO TRÌNH {course.jlptLevel || "N3"}
          </span>
          <h3 className="text-base sm:text-lg font-black text-[#0b1c30] dark:text-white tracking-tight">
            Mục lục khóa học
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Circular Progress Ring with Smooth Orange Stroke */}
          <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[#e5eeff] dark:text-slate-800 stroke-current"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#fd761a] stroke-current transition-all duration-500"
                strokeDasharray={`${progressPercent}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-[#0b1c30] dark:text-slate-200 font-mono">
              {progressPercent}%
            </span>
          </div>

          {/* Integrated Collapse Sidebar Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-[#d3e4fe] dark:border-slate-700 shadow-2xs transition-all active:scale-90 cursor-pointer ml-0.5"
              title="Ẩn mục lục (Mở rộng toàn màn hình)"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Search Input Bar (Playful Bento) ── */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm bài học, chương..."
          className="w-full pl-9 pr-8 py-2 rounded-full bg-[#eff4ff] dark:bg-slate-800/80 text-xs font-bold text-[#0b1c30] dark:text-white placeholder:text-slate-400 border border-[#d3e4fe] dark:border-slate-700 focus:border-purple-400 dark:focus:border-purple-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-inner transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSearchQuery("");
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2 rounded-full"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── 3. Section Accordion Group with Playful Bento Cards ── */}
      <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => {
            const isCollapsed = !searchQuery && !!collapsedSections[section.id];

            return (
              <div key={section.id} className="flex flex-col gap-1.5">
                {/* Parent Section Header Accordion (Bento Bar) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSection(section.id);
                  }}
                  className="flex items-center justify-between py-2 px-2.5 rounded-2xl bg-[#eff4ff]/80 hover:bg-[#dce9ff] dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-[#d3e4fe]/80 dark:border-slate-700/80 shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b] transition-all w-full text-left group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-orange-500 transition-transform">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-orange-500" />
                      )}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/60 dark:border-orange-800/40">
                      <FolderKanban className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-black text-[#0b1c30] dark:text-white truncate">
                      {section.title}
                    </span>
                  </div>

                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 font-mono px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-700 border border-[#d3e4fe] dark:border-slate-600 shadow-2xs shrink-0 ml-2">
                    {section.lessons.length} bài
                  </span>
                </button>

                {/* Indented Guide Line & Child Lessons (Playful Bento Tiles) */}
                {!isCollapsed && (
                  <div className="flex flex-col gap-2 ml-3.5 pl-3 border-l-2 border-[#d3e4fe] dark:border-slate-800 my-1">
                    {section.lessons.map((lesson) => {
                      const isActive = lesson.id === activeLessonId;
                      const isCompleted = !!completedLessonIds[lesson.id];
                      const duration = lesson.estimatedDurationMinutes || 24;
                      const chapterIndex = lessonIndexMap.get(lesson.id) || 1;
                      const formattedTitle = formatLessonTitle(lesson.title, chapterIndex);
                      const hasDocOnly = lesson.resources?.some(
                        (r) => r.resourceType === 2 || r.resourceType === 3 || r.resourceType === 5
                      ) && !lesson.resources?.some((r) => r.resourceType === 0);

                      const handleLessonClick = (e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectLesson(lesson, course, section);
                      };

                      // ── Item 1 (Active / Playing State): Bento Violet Lavender Tactile Card ──
                      if (isActive) {
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={handleLessonClick}
                            className="w-full text-left py-2.5 px-3 rounded-2xl bg-[#eff4ff] dark:bg-purple-950/50 border-2 border-purple-400 dark:border-purple-600 shadow-[0_3px_0_#c4b5fd] dark:shadow-[0_3px_0_#581c87] flex items-center justify-between gap-2.5 transition-all hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shadow-purple-500/30 shrink-0">
                                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-[#0b1c30] dark:text-purple-100 truncate leading-snug">
                                  {formattedTitle}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[10px] text-purple-700 dark:text-purple-300 font-bold mt-0.5">
                                  <span>{duration} phút</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <span className="inline-flex gap-0.5 items-end h-2">
                                      <span className="w-0.5 h-1.5 bg-purple-600 rounded-full animate-pulse" />
                                      <span className="w-0.5 h-2.5 bg-purple-600 rounded-full animate-pulse delay-75" />
                                      <span className="w-0.5 h-1 bg-purple-600 rounded-full animate-pulse delay-150" />
                                    </span>
                                    Đang học
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Soundwave equalizer icon */}
                            <div className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400 shrink-0 pr-0.5">
                              <span className="w-0.5 h-2 bg-purple-500 rounded-full" />
                              <span className="w-0.5 h-3.5 bg-purple-600 rounded-full" />
                              <span className="w-0.5 h-1.5 bg-purple-400 rounded-full" />
                            </div>
                          </button>
                        );
                      }

                      // ── Item 2 (Completed State): Bento Mint-Emerald Tactile Card ──
                      if (isCompleted) {
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={handleLessonClick}
                            className="w-full text-left py-2.5 px-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-[0_2px_0_#a7f3d0] dark:shadow-[0_2px_0_#064e3b] flex items-center justify-between gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shadow-emerald-500/20 shrink-0">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 truncate leading-snug">
                                  {formattedTitle}
                                </h4>
                                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                  {duration} phút • Đã hoàn thành
                                </p>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-black text-[9px] shadow-2xs shrink-0">
                              100%
                            </span>
                          </button>
                        );
                      }

                      // ── Items 3..N (Upcoming / Inactive State): Bento Daylight Tactile Card ──
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={handleLessonClick}
                          className="w-full text-left py-2.5 px-3 rounded-2xl bg-[#eff4ff]/60 hover:bg-[#dce9ff] dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b] flex items-center justify-between gap-2.5 transition-all group active:scale-[0.98] cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-600 shadow-2xs group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:border-purple-300 transition-colors">
                              {hasDocOnly ? (
                                <FileText className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                              ) : (
                                <PlayCircle className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-[#0b1c30] dark:text-slate-300 truncate leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {formattedTitle}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate font-semibold">
                                {duration} phút • {hasDocOnly ? "Tài liệu & Video bổ trợ" : (lesson.resources.length > 0 ? `${lesson.resources.length} tài liệu` : "Bài học chuẩn")}
                              </p>
                            </div>
                          </div>

                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 font-semibold">
            Không tìm thấy bài học phù hợp với &quot;{searchQuery}&quot;.
          </div>
        )}
      </div>
    </div>
  );
};
