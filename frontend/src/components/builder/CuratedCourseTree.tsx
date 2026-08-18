"use client";

import React, { useState } from "react";
import { Course, Section, Lesson, Resource } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Layers,
  FolderKanban,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Video,
  FileAudio,
  FileText,
  Image as ImageIcon,
  File,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ArrowDownToLine,
  ChevronsUpDown,
  Search,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  HelpCircle,
} from "lucide-react";

// ─── Drag payload type (matches RawDriveTree's dataTransfer structure) ───────
interface DragPayload {
  driveNodeId: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  fileExtension?: string;
  resourceType: number;
}

interface CuratedCourseTreeProps {
  courses: Course[];
  onAddCourse: () => void;
  onEditCourse?: (course: Course) => void;
  onAddSection: (courseId: string) => void;
  onEditSection?: (section: Section) => void;
  onAddLesson: (sectionId: string) => void;
  onEditLesson?: (lesson: Lesson) => void;
  onMoveLessonUp?: (section: Section, lessonIndex: number) => void;
  onMoveLessonDown?: (section: Section, lessonIndex: number) => void;
  onAssignQuiz?: (lesson: Lesson) => void;
  onAddManualResource?: (lesson: Lesson) => void;
  onRemoveResource: (resourceId: string) => void;
  onDeleteCourse: (course: Course) => void;
  onDeleteSection: (section: Section) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onDropFile: (lessonId: string, payload: DragPayload) => void;
}

export const CuratedCourseTree: React.FC<CuratedCourseTreeProps> = ({
  courses,
  onAddCourse,
  onEditCourse,
  onAddSection,
  onEditSection,
  onAddLesson,
  onEditLesson,
  onMoveLessonUp,
  onMoveLessonDown,
  onAssignQuiz,
  onAddManualResource,
  onRemoveResource,
  onDeleteCourse,
  onDeleteSection,
  onDeleteLesson,
  onDropFile,
}) => {
  const { t } = useI18n();
  const [collapsedCourses, setCollapsedCourses] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [dropTargetLessonId, setDropTargetLessonId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  // Maps lessonId → ephemeral success message shown for 2.5s after a drop
  const [dropSuccess, setDropSuccess] = useState<Record<string, string>>({});

  const toggleCourse = (courseId: string) =>
    setCollapsedCourses((prev) => ({ ...prev, [courseId]: !prev[courseId] }));
  const toggleSection = (sectionId: string) =>
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));

  const expandAll = () => {
    setCollapsedCourses({});
    setCollapsedSections({});
  };

  const collapseAll = () => {
    const allC: Record<string, boolean> = {};
    const allS: Record<string, boolean> = {};
    courses.forEach((c) => {
      allC[c.id] = true;
      c.sections.forEach((s) => {
        allS[s.id] = true;
      });
    });
    setCollapsedCourses(allC);
    setCollapsedSections(allS);
  };

  // ─── Resource badge ────────────────────────────────────────────────────────
  const getResourceTypeBadge = (type: number) => {
    switch (type) {
      case 0:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold shrink-0">
            <Video className="w-2.5 h-2.5" /> Video
          </span>
        );
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold shrink-0">
            <FileAudio className="w-2.5 h-2.5" /> Audio
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-semibold shrink-0">
            <FileText className="w-2.5 h-2.5" /> PDF
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold shrink-0">
            <FileText className="w-2.5 h-2.5" /> Doc
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold shrink-0">
            <ImageIcon className="w-2.5 h-2.5" /> Image
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-semibold shrink-0">
            <File className="w-2.5 h-2.5" /> File
          </span>
        );
    }
  };

  // ─── DnD Handlers ──────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent, lessonId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetLessonId(lessonId);
  };

  const handleDragLeave = () => {
    setDropTargetLessonId(null);
  };

  const handleDrop = (e: React.DragEvent, lessonId: string) => {
    e.preventDefault();
    setDropTargetLessonId(null);
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const payload = JSON.parse(raw) as DragPayload;
      onDropFile(lessonId, payload);
      // Show success toast inside the lesson row for 2.5s
      setDropSuccess((prev) => ({ ...prev, [lessonId]: `✓ Đã gán: ${payload.name}` }));
      setTimeout(() => {
        setDropSuccess((prev) => {
          const next = { ...prev };
          delete next[lessonId];
          return next;
        });
      }, 2500);
    } catch {
      // Invalid drag payload — ignore
    }
  };

  // ─── Empty State ──────────────────────────────────────────────────────────
  if (courses.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500 shrink-0" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">{t("curatedCourses")}</h2>
          </div>
          <button
            onClick={onAddCourse}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("addCourse")}
          </button>
        </div>
        {/* Empty state body */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <FolderKanban className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
              {t("noCoursesYet")}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Tạo khóa học để bắt đầu ánh xạ nội dung từ Google Drive.
            </p>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={onAddCourse}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all active:scale-95 shadow-md shadow-indigo-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("addCourse")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter courses based on searchFilter
  const filteredCourses = courses.filter((course) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase().trim();
    if (course.title.toLowerCase().includes(term) || course.jlptLevel.toLowerCase().includes(term)) return true;
    return course.sections.some(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.lessons.some((l) => l.title.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500 shrink-0" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">{t("curatedCourses")}</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              {courses.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Mở rộng tất cả các cấp"
            >
              Mở hết
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Thu gọn tất cả các cấp"
            >
              Thu gọn
            </button>
            <button
              onClick={onAddCourse}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("addCourse")}
            </button>
          </div>
        </div>

        {/* Search filter input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Lọc khóa học, chặng, bài học..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
          />
        </div>
      </div>

      {/* Courses list — single smooth scrollable container for the whole tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
        {filteredCourses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Không tìm thấy khóa học nào phù hợp với từ khóa &ldquo;{searchFilter}&rdquo;.
          </div>
        ) : (
          filteredCourses.map((course) => {
            const isCourseCollapsed = !!collapsedCourses[course.id];
            return (
              <div
                key={course.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 shadow-2xs"
              >
                {/* ─ Course Title Bar ─ */}
                <div className="p-3 bg-white dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleCourse(course.id)}
                    className="flex items-center gap-2 flex-1 text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0"
                  >
                    {isCourseCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] shrink-0">
                      {course.jlptLevel}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {course.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                      {course.sections.length} chặng
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {onEditCourse && (
                      <button
                        onClick={() => onEditCourse(course)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        title="Chỉnh sửa khóa học"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onAddSection(course.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold transition-colors"
                      title={t("addSection")}
                    >
                      <Plus className="w-3 h-3" />
                      {t("addSection")}
                    </button>
                    <button
                      onClick={() => onDeleteCourse(course)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      title={t("deleteCourse")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ─ Sections ─ */}
                {!isCourseCollapsed && (
                  <div className="p-3 flex flex-col gap-3">
                    {course.sections.length === 0 ? (
                      <div className="text-xs text-slate-400 italic px-2 py-2 text-center">
                        Chưa có chặng nào.{" "}
                        <button
                          onClick={() => onAddSection(course.id)}
                          className="text-indigo-500 hover:underline"
                        >
                          Thêm chặng đầu tiên?
                        </button>
                      </div>
                    ) : (
                      course.sections.map((section) => {
                        const isSectionCollapsed = !!collapsedSections[section.id];
                        return (
                          <div
                            key={section.id}
                            className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80"
                          >
                            {/* Section header */}
                            <div className="p-2.5 bg-slate-100/70 dark:bg-slate-700/40 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/50 gap-2">
                              <button
                                onClick={() => toggleSection(section.id)}
                                className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-500 transition-colors flex-1 min-w-0"
                              >
                                {isSectionCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <FolderKanban className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate">{section.title}</span>
                                <span className="text-[10px] text-slate-400 font-normal shrink-0 ml-1">
                                  {section.lessons.length} bài
                                </span>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                {onEditSection && (
                                  <button
                                    onClick={() => onEditSection(section)}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                    title="Sửa tên chặng"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onAddLesson(section.id)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-medium transition-colors"
                                  title={t("addLesson")}
                                >
                                  <Plus className="w-3 h-3" />
                                  {t("addLesson")}
                                </button>
                                <button
                                  onClick={() => onDeleteSection(section)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                  title={t("deleteSection")}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Lessons list - NATURAL HEIGHT, no scroll trap */}
                            {!isSectionCollapsed && (
                              <div className="p-2.5 flex flex-col gap-2">
                                {section.lessons.length === 0 ? (
                                  <div className="text-[11px] text-slate-400 italic px-2 py-2 text-center">
                                    Chưa có bài học.
                                  </div>
                                ) : (
                                  section.lessons.map((lesson, lIdx) => {
                                    const isDropTarget = dropTargetLessonId === lesson.id;
                                    return (
                                      <div
                                        key={lesson.id}
                                        className={`p-2.5 rounded-lg border transition-all ${
                                          isDropTarget
                                            ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-2 ring-indigo-400/30"
                                            : dropSuccess[lesson.id]
                                            ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10"
                                            : "border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/40"
                                        }`}
                                        onDragOver={(e) => handleDragOver(e, lesson.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, lesson.id)}
                                      >
                                        {/* Lesson header row */}
                                        <div className="flex items-center justify-between mb-2 gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {/* Reorder Buttons (Move Up / Down) */}
                                            <div className="flex items-center gap-0.5 shrink-0 bg-slate-200/70 dark:bg-slate-700/60 p-0.5 rounded-md">
                                              {onMoveLessonUp && (
                                                <button
                                                  onClick={() => onMoveLessonUp(section, lIdx)}
                                                  disabled={lIdx === 0}
                                                  className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 transition-all cursor-pointer disabled:cursor-not-allowed"
                                                  title="Chuyển bài học lên trên (Thứ tự)"
                                                >
                                                  <ArrowUp className="w-3 h-3" />
                                                </button>
                                              )}
                                              {onMoveLessonDown && (
                                                <button
                                                  onClick={() => onMoveLessonDown(section, lIdx)}
                                                  disabled={lIdx === section.lessons.length - 1}
                                                  className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 transition-all cursor-pointer disabled:cursor-not-allowed"
                                                  title="Chuyển bài học xuống dưới (Thứ tự)"
                                                >
                                                  <ArrowDown className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>

                                            <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                                              {lesson.title}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {lesson.resources.length} res
                                            </span>

                                            {/* Assign Quiz Button */}
                                            {onAssignQuiz && (
                                              <button
                                                onClick={() => onAssignQuiz(lesson)}
                                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:bg-amber-100 text-[10px] font-bold border border-amber-200 dark:border-amber-800 transition-colors"
                                                title="Gắn đề thi / Quiz vào bài học"
                                              >
                                                <HelpCircle className="w-2.5 h-2.5" />
                                                <span>+ Quiz</span>
                                              </button>
                                            )}

                                            {onAddManualResource && (
                                              <button
                                                onClick={() => onAddManualResource(lesson)}
                                                className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                                title="Gắn link tài nguyên thủ công"
                                              >
                                                <PlusCircle className="w-3 h-3" />
                                              </button>
                                            )}
                                            {onEditLesson && (
                                              <button
                                                onClick={() => onEditLesson(lesson)}
                                                className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                                title="Sửa tên bài học"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                            )}
                                            <button
                                              onClick={() => onDeleteLesson(lesson)}
                                              className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                              title={t("deleteLesson")}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Assigned Quizzes Badges */}
                                        {lesson.quizzes && lesson.quizzes.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 pl-6 mb-2">
                                            {lesson.quizzes.map((q) => (
                                              <div
                                                key={q.id}
                                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold"
                                              >
                                                <HelpCircle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                                <span className="truncate max-w-[180px]">{q.title}</span>
                                                <span className="text-[9px] opacity-75 font-mono">({q.questionCount} câu)</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Drop zone hint while dragging */}
                                        {isDropTarget && (
                                          <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-indigo-500 font-semibold animate-pulse">
                                            <ArrowDownToLine className="w-3.5 h-3.5" />
                                            {t("dropFileHere")}
                                          </div>
                                        )}

                                        {/* Drop success flash */}
                                        {dropSuccess[lesson.id] && (
                                          <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                            <span>{dropSuccess[lesson.id]}</span>
                                          </div>
                                        )}

                                        {/* Resources */}
                                        <div className="flex flex-wrap gap-1.5 pl-5">
                                          {lesson.resources.length === 0 && !isDropTarget ? (
                                            <span className="text-[10px] text-slate-400 italic">
                                              {t("dragToAssign")}
                                            </span>
                                          ) : (
                                            lesson.resources.map((res) => (
                                              <div
                                                key={res.id}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs group hover:border-indigo-400 transition-colors"
                                              >
                                                {getResourceTypeBadge(res.resourceType)}
                                                <span className="truncate max-w-[150px] text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                                  {res.title}
                                                </span>
                                                {res.webViewLink && (
                                                  <a
                                                    href={res.webViewLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                  >
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                  </a>
                                                )}
                                                <button
                                                  onClick={() => onRemoveResource(res.id)}
                                                  className="text-slate-400 hover:text-rose-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Remove resource"
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
