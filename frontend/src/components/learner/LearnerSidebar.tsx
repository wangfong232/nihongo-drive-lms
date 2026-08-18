"use client";

import React, { useState } from "react";
import { Course, Section, Lesson } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  BookOpen, FolderKanban, CheckCircle2, Circle, Search, ChevronDown,
  ChevronRight, PanelLeftClose, PanelLeftOpen, Sparkles, PlayCircle,
  FileText, Headphones, HelpCircle
} from "lucide-react";

interface LearnerSidebarProps {
  courses: Course[];
  activeLessonId?: string;
  onSelectLesson: (lesson: Lesson, course: Course, section: Section) => void;
  completedLessonIds?: Record<string, boolean>;
}

export const LearnerSidebar: React.FC<LearnerSidebarProps> = ({
  courses,
  activeLessonId,
  onSelectLesson,
  completedLessonIds = {},
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const getCourseProgress = (course: Course) => {
    const allLessons = course.sections.flatMap((s) => s.lessons);
    if (allLessons.length === 0) return 0;
    const completedCount = allLessons.filter((l) => completedLessonIds[l.id]).length;
    return Math.round((completedCount / allLessons.length) * 100);
  };

  const getLessonIcon = (lesson: Lesson, isActive: boolean) => {
    const hasVideo = lesson.resources?.some((r) => r.resourceType === 0);
    const hasDoc = lesson.resources?.some((r) => r.resourceType === 2 || r.resourceType === 3 || r.resourceType === 5 || r.resourceType === 4);
    const hasAudio = lesson.resources?.some((r) => r.resourceType === 1);
    const hasQuiz = (lesson as any).quizzes && (lesson as any).quizzes.length > 0;

    if (hasVideo) {
      return <PlayCircle className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-indigo-400 group-hover:text-orange-500"}`} />;
    }
    if (hasDoc) {
      return <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-rose-400 group-hover:text-orange-500"}`} />;
    }
    if (hasAudio) {
      return <Headphones className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-emerald-400 group-hover:text-orange-500"}`} />;
    }
    if (hasQuiz) {
      return <HelpCircle className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-amber-400 group-hover:text-orange-500"}`} />;
    }
    return <PlayCircle className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-orange-500"}`} />;
  };

  return (
    <aside
      className={`transition-all duration-300 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shadow-sm ${
        isSidebarOpen ? "w-80" : "w-14"
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        {isSidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Lộ Trình Học Tập
            </span>
          </div>
        )}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors mx-auto"
          title={isSidebarOpen ? "Thu gọn thanh bên" : "Mở rộng thanh bên"}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
      </div>

      {isSidebarOpen && (
        <>
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bài học..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs border-0 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 font-medium"
              />
            </div>
          </div>

          {/* Navigation Tree */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {courses.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Chưa có khóa học nào.</div>
            ) : (
              courses.map((course) => {
                const progress = getCourseProgress(course);
                return (
                  <div key={course.id} className="flex flex-col gap-2">
                    {/* Course Banner Box */}
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-xs text-white truncate max-w-[170px]">
                          {course.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white font-extrabold text-[10px]">
                          {course.jlptLevel}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden p-0.5 flex items-center">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1.5">
                        <span>Tiến độ học</span>
                        <span className="font-bold text-orange-400">{progress}%</span>
                      </div>
                    </div>

                    {/* Sections (Chặng) */}
                    <div className="flex flex-col gap-1.5 pl-1">
                      {course.sections.map((section) => {
                        const isCollapsed = collapsedSections[section.id];
                        const matchingLessons = search
                          ? section.lessons.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()))
                          : section.lessons;

                        if (search && matchingLessons.length === 0) return null;

                        return (
                          <div key={section.id} className="flex flex-col">
                            {/* Section Header */}
                            <button
                              onClick={() => toggleSection(section.id)}
                              className="flex items-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors w-full text-left"
                            >
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                              <FolderKanban className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate flex-1 font-bold">{section.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{section.lessons.length} bài</span>
                            </button>

                            {/* Lessons List */}
                            {!isCollapsed && (
                              <div className="flex flex-col gap-1 pl-4 border-l-2 border-slate-200 dark:border-slate-800 my-1">
                                {matchingLessons.map((lesson) => {
                                  const isActive = lesson.id === activeLessonId;
                                  const isCompleted = completedLessonIds[lesson.id];

                                  return (
                                    <button
                                      key={lesson.id}
                                      onClick={() => onSelectLesson(lesson, course, section)}
                                      className={`flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold transition-all text-left group ${
                                        isActive
                                          ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-500/20"
                                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                                        {getLessonIcon(lesson, isActive)}
                                        <span className="truncate">{lesson.title}</span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {isCompleted ? (
                                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${isActive ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                                            Đã học ✓
                                          </span>
                                        ) : isActive ? (
                                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white/20 text-white animate-pulse">
                                            Đang học
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-slate-400 px-1">
                                            {lesson.estimatedDurationMinutes ? `${lesson.estimatedDurationMinutes}m` : ""}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
};
