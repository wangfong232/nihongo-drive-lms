"use client";

import React, { useState, useCallback, memo } from "react";
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
  Search,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  GripVertical,
  ListOrdered,
  X,
  Check,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";

// ─── Drag payload types ──────────────────────────────────────────────────────
export interface DriveDragItem {
  driveNodeId: string;
  driveFileId?: string;
  name: string;
  mimeType: string;
  fileExtension?: string;
  resourceType: number;
}

export interface DriveDragPayload {
  type?: string;
  driveNodeId?: string;
  driveFileId?: string;
  name?: string;
  mimeType?: string;
  fileExtension?: string;
  resourceType?: number;
  items?: DriveDragItem[];
}

interface ResourceDragData {
  type: "resource-item";
  resourceId: string;
  sourceLessonId: string;
  sourceIndex: number;
  title: string;
  resourceType: number;
}

interface LessonDragData {
  type: "lesson-item";
  lessonId: string;
  sourceSectionId: string;
  sourceIndex: number;
  title: string;
}

interface SectionDragData {
  type: "section-item";
  sectionId: string;
  courseId: string;
  sourceIndex: number;
  title: string;
}

interface CuratedCourseTreeProps {
  courses: Course[];
  onAddCourse: () => void;
  onEditCourse?: (course: Course) => void;
  onAddSection: (courseId: string) => void;
  onEditSection?: (section: Section) => void;
  onMoveSectionUp?: (course: Course, sectionIndex: number) => void;
  onMoveSectionDown?: (course: Course, sectionIndex: number) => void;
  onAddLesson: (sectionId: string) => void;
  onEditLesson?: (lesson: Lesson) => void;
  onMoveLessonUp?: (section: Section, lessonIndex: number) => void;
  onMoveLessonDown?: (section: Section, lessonIndex: number) => void;
  onAssignQuiz?: (lesson: Lesson) => void;
  onAddManualResource?: (lesson: Lesson) => void;
  onRemoveResource: (resourceId: string) => void;
  onReorderResources?: (lessonId: string, resourceIds: string[]) => void;
  onMoveResource?: (resourceId: string, targetLessonId: string, targetIndex?: number) => void;
  onMoveLesson?: (lessonId: string, targetSectionId: string, targetIndex?: number) => void;
  onReorderSections?: (courseId: string, sectionIds: string[]) => void;
  onReorderLessons?: (sectionId: string, lessonIds: string[]) => void;
  onDeleteCourse: (course: Course) => void;
  onDeleteSection: (section: Section) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onDropFile: (lessonId: string, payload: DriveDragPayload) => void;
}

/** Helper to safely extract drag JSON payload */
function parseDragPayload(e: React.DragEvent): any {
  try {
    const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Resource badge renderer ─────────────────────────────────────────────────
const getResourceTypeBadge = (type: number) => {
  switch (type) {
    case 0:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold shrink-0">
          <Video className="w-3.5 h-3.5" /> Video
        </span>
      );
    case 1:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold shrink-0">
          <FileAudio className="w-3.5 h-3.5" /> Audio
        </span>
      );
    case 2:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[11px] font-bold shrink-0">
          <FileText className="w-3.5 h-3.5" /> PDF
        </span>
      );
    case 3:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[11px] font-bold shrink-0">
          <FileText className="w-3.5 h-3.5" /> Doc
        </span>
      );
    case 4:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold shrink-0">
          <ImageIcon className="w-3.5 h-3.5" /> Image
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-500/15 text-slate-600 dark:text-slate-400 text-[11px] font-bold shrink-0">
          <File className="w-3.5 h-3.5" /> File
        </span>
      );
  }
};

// ─── Sub-component: Resource Item ────────────────────────────────────────────
interface ResourceItemProps {
  res: Resource;
  rIdx: number;
  lessonId: string;
  totalResources: number;
  isTargetRes: boolean;
  onMoveResourceQuick: (rIdx: number, direction: "left" | "right") => void;
  onRemoveResource: (resourceId: string) => void;
  onResourceDragStart: (e: React.DragEvent, res: Resource, lessonId: string, index: number) => void;
  onResourceDragOver: (e: React.DragEvent, lessonId: string, index: number) => void;
  onResourceDrop: (e: React.DragEvent, lessonId: string, index: number) => void;
  onDragLeave: () => void;
}

const ResourceItem: React.FC<ResourceItemProps> = memo(({
  res,
  rIdx,
  lessonId,
  totalResources,
  isTargetRes,
  onMoveResourceQuick,
  onRemoveResource,
  onResourceDragStart,
  onResourceDragOver,
  onResourceDrop,
  onDragLeave,
}) => {
  return (
    <div
      draggable={true}
      onDragStart={(e) => onResourceDragStart(e, res, lessonId, rIdx)}
      onDragOver={(e) => onResourceDragOver(e, lessonId, rIdx)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onResourceDrop(e, lessonId, rIdx)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border shadow-xs group transition-all select-none cursor-grab active:cursor-grabbing ${
        isTargetRes
          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 ring-2 ring-orange-400/50 scale-105"
          : "border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:shadow-sm"
      }`}
      title="Kéo thả để sắp xếp thứ tự hoặc kéo sang bài học khác"
    >
      <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 shrink-0" />
      <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 shrink-0">
        {rIdx + 1}.
      </span>
      {getResourceTypeBadge(res.resourceType)}
      <span className="truncate max-w-[220px] text-xs font-semibold text-slate-800 dark:text-slate-200">
        {res.title}
      </span>

      {/* Action buttons inside pill - always visible on hover with comfortable hit targets */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded-md ml-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveResourceQuick(rIdx, "left");
          }}
          disabled={rIdx === 0}
          className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-600 rounded disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
          title="Chuyển sang trái (lên trước)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveResourceQuick(rIdx, "right");
          }}
          disabled={rIdx === totalResources - 1}
          className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-600 rounded disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
          title="Chuyển sang phải (xuống sau)"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {res.webViewLink && (
        <a
          href={res.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors shrink-0 ml-0.5"
          title="Mở trên Google Drive"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveResource(res.id);
        }}
        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="Xóa tài nguyên khỏi bài học"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
ResourceItem.displayName = "ResourceItem";

// ─── Sub-component: Lesson Card ──────────────────────────────────────────────
interface LessonCardProps {
  lesson: Lesson;
  lIdx: number;
  section: Section;
  isDropTarget: boolean;
  isLessonReorderTarget: boolean;
  dropSuccessMsg?: string;
  dropTargetResourceIdx: number | null;
  onMoveLessonUp?: (section: Section, lessonIndex: number) => void;
  onMoveLessonDown?: (section: Section, lessonIndex: number) => void;
  onAssignQuiz?: (lesson: Lesson) => void;
  onAddManualResource?: (lesson: Lesson) => void;
  onEditLesson?: (lesson: Lesson) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onMoveResourceQuick: (lesson: Lesson, rIdx: number, direction: "left" | "right") => void;
  onRemoveResource: (resourceId: string) => void;
  onLessonDragStart: (e: React.DragEvent, lesson: Lesson, sectionId: string, index: number) => void;
  onLessonDragOver: (e: React.DragEvent, lessonId: string) => void;
  onLessonDrop: (e: React.DragEvent, targetLessonId: string, targetSectionId: string, targetLessonIndex: number) => void;
  onResourceDragStart: (e: React.DragEvent, res: Resource, lessonId: string, index: number) => void;
  onResourceDragOver: (e: React.DragEvent, lessonId: string, index: number) => void;
  onResourceDrop: (e: React.DragEvent, lessonId: string, index: number) => void;
  onDragLeave: () => void;
}

const LessonCard: React.FC<LessonCardProps> = memo(({
  lesson,
  lIdx,
  section,
  isDropTarget,
  isLessonReorderTarget,
  dropSuccessMsg,
  dropTargetResourceIdx,
  onMoveLessonUp,
  onMoveLessonDown,
  onAssignQuiz,
  onAddManualResource,
  onEditLesson,
  onDeleteLesson,
  onMoveResourceQuick,
  onRemoveResource,
  onLessonDragStart,
  onLessonDragOver,
  onLessonDrop,
  onResourceDragStart,
  onResourceDragOver,
  onResourceDrop,
  onDragLeave,
}) => {
  const { t } = useI18n();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onLessonDragOver(e, lesson.id);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onLessonDrop(e, lesson.id, section.id, lIdx);
      }}
      className={`p-2.5 rounded-lg border transition-all ${
        isDropTarget
          ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/30 ring-2 ring-indigo-400/50 shadow-md"
          : isLessonReorderTarget
          ? "border-amber-500 dark:border-amber-400 bg-amber-50/70 dark:bg-amber-900/30 ring-2 ring-amber-400/50"
          : dropSuccessMsg
          ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/20"
          : "border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            draggable={true}
            onDragStart={(e) => onLessonDragStart(e, lesson, section.id, lIdx)}
            className="p-1 -ml-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors shrink-0"
            title="Kéo thả để di chuyển hoặc đổi thứ tự bài học"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-0.5 shrink-0 bg-slate-200/70 dark:bg-slate-700/60 p-0.5 rounded-md">
            {onMoveLessonUp && (
              <button
                type="button"
                onClick={() => onMoveLessonUp(section, lIdx)}
                disabled={lIdx === 0}
                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Chuyển bài học lên trên"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            )}
            {onMoveLessonDown && (
              <button
                type="button"
                onClick={() => onMoveLessonDown(section, lIdx)}
                disabled={lIdx === section.lessons.length - 1}
                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Chuyển bài học xuống dưới"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            )}
          </div>

          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10px] shrink-0">
            #{lIdx + 1}
          </span>
          <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
            {lesson.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">
            {lesson.resources.length} res
          </span>

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

      {isDropTarget && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 text-xs text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-500/15 border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-lg mb-2 animate-pulse">
          <ArrowDownToLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Thả vào đây để gán tài nguyên từ Drive hoặc chuyển bài học</span>
        </div>
      )}

      {dropSuccessMsg && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/15 rounded-md mb-2">
          <span>{dropSuccessMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pl-5 items-center">
        {lesson.resources.length === 0 && !isDropTarget ? (
          <span className="text-[10px] text-slate-400 italic">
            {t("dragToAssign")}
          </span>
        ) : (
          lesson.resources.map((res, rIdx) => {
            const isTargetRes = dropTargetResourceIdx === rIdx;
            return (
              <ResourceItem
                key={res.id}
                res={res}
                rIdx={rIdx}
                lessonId={lesson.id}
                totalResources={lesson.resources.length}
                isTargetRes={isTargetRes}
                onMoveResourceQuick={(idx, dir) => onMoveResourceQuick(lesson, idx, dir)}
                onRemoveResource={onRemoveResource}
                onResourceDragStart={onResourceDragStart}
                onResourceDragOver={onResourceDragOver}
                onResourceDrop={onResourceDrop}
                onDragLeave={onDragLeave}
              />
            );
          })
        )}
      </div>
    </div>
  );
});
LessonCard.displayName = "LessonCard";

// ─── Quick Reorder Modal (Sắp xếp nhanh hàng loạt) ──────────────────────────
interface QuickReorderModalProps {
  title: string;
  items: { id: string; title: string; subtitle?: string }[];
  otherSections?: { id: string; title: string }[];
  onSave: (newIds: string[]) => void;
  onMoveToSection?: (itemId: string, targetSectionId: string) => void;
  onClose: () => void;
}

const QuickReorderModal: React.FC<QuickReorderModalProps> = ({
  title,
  items,
  otherSections,
  onSave,
  onMoveToSection,
  onClose,
}) => {
  const [list, setList] = useState(items);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;
    const updated = [...list];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setList(updated);
  };

  const handleJumpToPosition = (fromIndex: number, targetPos1Based: number) => {
    const toIndex = targetPos1Based - 1;
    handleMove(fromIndex, toIndex);
  };

  const handleApply = () => {
    onSave(list.map((i) => i.id));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 max-w-4xl w-full flex flex-col gap-3.5 shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
          <span className="font-medium">💡 Kéo tay cầm ⠿, chọn trực tiếp số thứ tự <code className="text-amber-600 font-bold bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">#N</code> hoặc bấm nút mũi tên để đổi vị trí:</span>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
            Tổng {list.length} bài học
          </span>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-1 max-h-[58vh]">
          {list.map((item, idx) => (
            <div
              key={item.id}
              draggable={true}
              onDragStart={() => setDraggedIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  handleMove(draggedIdx, idx);
                  setDraggedIdx(idx);
                }
              }}
              onDragEnd={() => setDraggedIdx(null)}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs hover:border-amber-400 transition-all select-none group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-amber-500 cursor-grab active:cursor-grabbing shrink-0" />
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400">Vị trí:</span>
                  <select
                    value={idx + 1}
                    onChange={(e) => handleJumpToPosition(idx, parseInt(e.target.value))}
                    className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-md text-xs focus:outline-none cursor-pointer"
                    title="Chọn trực tiếp số thứ tự mới"
                  >
                    {list.map((_, pIdx) => (
                      <option key={pIdx + 1} value={pIdx + 1}>
                        #{pIdx + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                    {item.title}
                  </span>
                  {item.subtitle && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 bg-slate-200/70 dark:bg-slate-700/60 px-2 py-0.5 rounded-full font-mono">
                      {item.subtitle}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {otherSections && otherSections.length > 0 && onMoveToSection && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        onMoveToSection(item.id, e.target.value);
                        setList((prev) => prev.filter((i) => i.id !== item.id));
                      }
                    }}
                    defaultValue=""
                    className="text-[11px] bg-slate-200/80 dark:bg-slate-700 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                    title="Chuyển sang chặng khác"
                  >
                    <option value="" disabled>Chuyển chặng...</option>
                    {otherSections.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-0.5 bg-slate-200/70 dark:bg-slate-700/60 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 0)}
                    disabled={idx === 0}
                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Chuyển lên đầu danh sách"
                  >
                    <ChevronsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, idx - 1)}
                    disabled={idx === 0}
                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Lên trên 1 nấc"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, idx + 1)}
                    disabled={idx === list.length - 1}
                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Xuống dưới 1 nấc"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, list.length - 1)}
                    disabled={idx === list.length - 1}
                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Chuyển xuống cuối danh sách"
                  >
                    <ChevronsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            Lưu Thứ Tự Mới
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main CuratedCourseTree Component ────────────────────────────────────────
export const CuratedCourseTree: React.FC<CuratedCourseTreeProps> = ({
  courses,
  onAddCourse,
  onEditCourse,
  onAddSection,
  onEditSection,
  onMoveSectionUp,
  onMoveSectionDown,
  onAddLesson,
  onEditLesson,
  onMoveLessonUp,
  onMoveLessonDown,
  onAssignQuiz,
  onAddManualResource,
  onRemoveResource,
  onReorderResources,
  onMoveResource,
  onMoveLesson,
  onReorderSections,
  onReorderLessons,
  onDeleteCourse,
  onDeleteSection,
  onDeleteLesson,
  onDropFile,
}) => {
  const { t } = useI18n();
  const [collapsedCourses, setCollapsedCourses] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  
  const [dropTargetLessonId, setDropTargetLessonId] = useState<string | null>(null);
  const [dropTargetResource, setDropTargetResource] = useState<{ lessonId: string; index: number } | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);
  const [dropTargetLessonReorderId, setDropTargetLessonReorderId] = useState<string | null>(null);

  const [searchFilter, setSearchFilter] = useState("");
  const [dropSuccess, setDropSuccess] = useState<Record<string, string>>({});

  const [quickReorderTarget, setQuickReorderTarget] = useState<{
    type: "section-lessons" | "course-sections";
    title: string;
    sectionId?: string;
    courseId?: string;
    items: { id: string; title: string; subtitle?: string }[];
    otherSections?: { id: string; title: string }[];
  } | null>(null);

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

  // ─── Drag & Drop Event Handlers ────────────────────────────────────────────
  const handleDragLeave = useCallback(() => {
    setDropTargetLessonId(null);
    setDropTargetResource(null);
    setDropTargetSectionId(null);
    setDropTargetLessonReorderId(null);
  }, []);

  const handleLessonDragOver = useCallback((e: React.DragEvent, lessonId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetLessonId((prev) => (prev === lessonId ? prev : lessonId));
  }, []);

  // ─── Lesson Drag Start ─────────────────────────────────────────────────────
  const handleLessonDragStart = useCallback((e: React.DragEvent, lesson: Lesson, sectionId: string, index: number) => {
    e.stopPropagation();
    const data: LessonDragData = {
      type: "lesson-item",
      lessonId: lesson.id,
      sourceSectionId: sectionId,
      sourceIndex: index,
      title: lesson.title,
    };
    const jsonStr = JSON.stringify(data);
    e.dataTransfer.setData("application/json", jsonStr);
    e.dataTransfer.setData("text/plain", jsonStr);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  // ─── Lesson Drop (Handles Drive files, Cross-Lesson Resources, and Lesson Reorder) ──
  const handleLessonDrop = useCallback((e: React.DragEvent, targetLessonId: string, targetSectionId: string, targetLessonIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetLessonId(null);
    setDropTargetResource(null);
    setDropTargetLessonReorderId(null);

    const data = parseDragPayload(e);
    if (!data) return;

    // Case 1: Dropped Google Drive file(s) from left panel (Single or Multi-select)
    if (data.type === "drive-file" || data.driveNodeId || data.items) {
      onDropFile(targetLessonId, data as DriveDragPayload);
      const count = data.items && data.items.length > 1 ? data.items.length : 1;
      const msg = count > 1 ? `✓ Đã gán ${count} tài nguyên` : `✓ Đã gán: ${data.name || (data.items && data.items[0]?.name)}`;
      setDropSuccess((prev) => ({ ...prev, [targetLessonId]: msg }));
      setTimeout(() => {
        setDropSuccess((prev) => {
          const next = { ...prev };
          delete next[targetLessonId];
          return next;
        });
      }, 2500);
      return;
    }

    // Case 2: Dropped a Resource from another lesson (Cross-lesson move)
    if (data.type === "resource-item") {
      const { resourceId, sourceLessonId, title } = data as ResourceDragData;
      if (sourceLessonId !== targetLessonId && onMoveResource) {
        onMoveResource(resourceId, targetLessonId);
        setDropSuccess((prev) => ({ ...prev, [targetLessonId]: `✓ Đã chuyển: ${title}` }));
        setTimeout(() => {
          setDropSuccess((prev) => {
            const next = { ...prev };
            delete next[targetLessonId];
            return next;
          });
        }, 2500);
      }
      return;
    }

    // Case 3: Dropped a Lesson onto this lesson (Reorder or move to section)
    if (data.type === "lesson-item") {
      const { lessonId, sourceSectionId, sourceIndex } = data as LessonDragData;
      if (sourceSectionId === targetSectionId) {
        if (sourceIndex === targetLessonIndex) return;
        for (const c of courses) {
          const sec = c.sections.find((s) => s.id === targetSectionId);
          if (sec) {
            const reordered = [...sec.lessons];
            const [moved] = reordered.splice(sourceIndex, 1);
            reordered.splice(targetLessonIndex, 0, moved);
            if (onReorderLessons) {
              onReorderLessons(targetSectionId, reordered.map((l) => l.id));
            }
            return;
          }
        }
      } else {
        if (onMoveLesson) {
          onMoveLesson(lessonId, targetSectionId, targetLessonIndex);
        }
      }
    }
  }, [courses, onDropFile, onMoveResource, onReorderLessons, onMoveLesson]);

  // ─── Resource Drag Start ───────────────────────────────────────────────────
  const handleResourceDragStart = useCallback((e: React.DragEvent, res: Resource, lessonId: string, index: number) => {
    e.stopPropagation();
    const data: ResourceDragData = {
      type: "resource-item",
      resourceId: res.id,
      sourceLessonId: lessonId,
      sourceIndex: index,
      title: res.title,
      resourceType: res.resourceType,
    };
    const jsonStr = JSON.stringify(data);
    e.dataTransfer.setData("application/json", jsonStr);
    e.dataTransfer.setData("text/plain", jsonStr);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleResourceDragOver = useCallback((e: React.DragEvent, lessonId: string, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropTargetResource((prev) => {
      if (prev && prev.lessonId === lessonId && prev.index === targetIndex) return prev;
      return { lessonId, index: targetIndex };
    });
  }, []);

  const handleResourceDrop = useCallback((e: React.DragEvent, targetLessonId: string, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetResource(null);
    setDropTargetLessonId(null);

    const data = parseDragPayload(e);
    if (!data) return;

    if (data.type === "drive-file" || data.driveNodeId || data.items) {
      onDropFile(targetLessonId, data as DriveDragPayload);
      const count = data.items && data.items.length > 1 ? data.items.length : 1;
      const msg = count > 1 ? `✓ Đã gán ${count} tài nguyên` : `✓ Đã gán: ${data.name || (data.items && data.items[0]?.name)}`;
      setDropSuccess((prev) => ({ ...prev, [targetLessonId]: msg }));
      setTimeout(() => {
        setDropSuccess((prev) => {
          const next = { ...prev };
          delete next[targetLessonId];
          return next;
        });
      }, 2500);
      return;
    }

    if (data.type === "resource-item") {
      const { resourceId, sourceLessonId, sourceIndex, title } = data as ResourceDragData;
      if (sourceLessonId === targetLessonId) {
        if (sourceIndex === targetIndex) return;
        for (const c of courses) {
          for (const s of c.sections) {
            const les = s.lessons.find((l) => l.id === targetLessonId);
            if (les) {
              const reordered = [...les.resources];
              const [moved] = reordered.splice(sourceIndex, 1);
              reordered.splice(targetIndex, 0, moved);
              if (onReorderResources) {
                onReorderResources(targetLessonId, reordered.map((r) => r.id));
              }
              return;
            }
          }
        }
      } else {
        if (onMoveResource) {
          onMoveResource(resourceId, targetLessonId, targetIndex);
          setDropSuccess((prev) => ({ ...prev, [targetLessonId]: `✓ Đã chuyển: ${title}` }));
          setTimeout(() => {
            setDropSuccess((prev) => {
              const next = { ...prev };
              delete next[targetLessonId];
              return next;
            });
          }, 2500);
        }
      }
    }
  }, [courses, onDropFile, onMoveResource, onReorderResources]);

  // ─── Section Drag & Drop Reordering ────────────────────────────────────────
  const handleSectionDragStart = useCallback((e: React.DragEvent, section: Section, courseId: string, index: number) => {
    e.stopPropagation();
    const data: SectionDragData = {
      type: "section-item",
      sectionId: section.id,
      courseId,
      sourceIndex: index,
      title: section.title,
    };
    const jsonStr = JSON.stringify(data);
    e.dataTransfer.setData("application/json", jsonStr);
    e.dataTransfer.setData("text/plain", jsonStr);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleSectionDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetSectionId((prev) => (prev === sectionId ? prev : sectionId));
  }, []);

  const handleSectionDrop = useCallback((e: React.DragEvent, courseId: string, targetIndex: number) => {
    e.preventDefault();
    setDropTargetSectionId(null);

    const data = parseDragPayload(e);
    if (!data) return;

    if (data.type === "section-item" && data.courseId === courseId) {
      const { sourceIndex } = data as SectionDragData;
      if (sourceIndex === targetIndex) return;
      const targetCourse = courses.find((c) => c.id === courseId);
      if (targetCourse) {
        const reordered = [...targetCourse.sections];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);
        if (onReorderSections) {
          onReorderSections(courseId, reordered.map((s) => s.id));
        }
      }
    }
  }, [courses, onReorderSections]);

  // ─── Quick Move Resource (Left / Right) ────────────────────────────────────
  const handleMoveResourceQuick = useCallback((lesson: Lesson, rIdx: number, direction: "left" | "right") => {
    const targetIdx = direction === "left" ? rIdx - 1 : rIdx + 1;
    if (targetIdx < 0 || targetIdx >= lesson.resources.length) return;
    const reordered = [...lesson.resources];
    const [moved] = reordered.splice(rIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    if (onReorderResources) {
      onReorderResources(lesson.id, reordered.map((r) => r.id));
    }
  }, [onReorderResources]);

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
      <div className="shrink-0 p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-900/40">
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
            >
              Mở hết
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
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

      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 flex flex-col gap-3.5 custom-scrollbar">
        {filteredCourses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Không tìm thấy khóa học nào phù hợp.</div>
        ) : (
          filteredCourses.map((course) => {
            const isCourseCollapsed = !!collapsedCourses[course.id];
            return (
              <div key={course.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 shadow-2xs">
                <div className="p-3 bg-white dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleCourse(course.id)}
                    className="flex items-center gap-2 flex-1 text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0"
                  >
                    {isCourseCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] shrink-0">{course.jlptLevel}</span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{course.title}</h3>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">{course.sections.length} chặng</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {course.sections.length > 1 && (
                      <button
                        onClick={() => setQuickReorderTarget({
                          type: "course-sections",
                          title: `Sắp xếp các Chặng trong: ${course.title}`,
                          courseId: course.id,
                          items: course.sections.map((s) => ({ id: s.id, title: s.title, subtitle: `${s.lessons.length} bài học` })),
                        })}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50 text-[11px] font-bold transition-colors"
                      >
                        <ListOrdered className="w-3 h-3 text-amber-500" />
                        <span>Sắp xếp Chặng</span>
                      </button>
                    )}
                    {onEditCourse && (
                      <button onClick={() => onEditCourse(course)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => onAddSection(course.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold transition-colors">
                      <Plus className="w-3 h-3" /> {t("addSection")}
                    </button>
                    <button onClick={() => onDeleteCourse(course)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {!isCourseCollapsed && (
                  <div className="p-3 flex flex-col gap-3">
                    {course.sections.length === 0 ? (
                      <div className="text-xs text-slate-400 italic px-2 py-2 text-center">Chưa có chặng nào.</div>
                    ) : (
                      course.sections.map((section, sIdx) => {
                        const isSectionCollapsed = !!collapsedSections[section.id];
                        const isSectionDragTarget = dropTargetSectionId === section.id;
                        return (
                          <div key={section.id} onDragOver={(e) => handleSectionDragOver(e, section.id)} onDrop={(e) => handleSectionDrop(e, course.id, sIdx)} className={`rounded-xl bg-white dark:bg-slate-800 border transition-all ${isSectionDragTarget ? "border-amber-400 ring-2 ring-amber-400/40 bg-amber-50/30" : "border-slate-200/80 dark:border-slate-700/80"}`}>
                            <div className="p-2.5 bg-slate-100/70 dark:bg-slate-700/40 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/50 gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div draggable={true} onDragStart={(e) => handleSectionDragStart(e, section, course.id, sIdx)} className="p-1 -ml-1 text-slate-400 hover:text-amber-500 cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors shrink-0">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0 bg-slate-200/80 dark:bg-slate-700/80 p-0.5 rounded-md">
                                  {onMoveSectionUp && <button type="button" onClick={() => onMoveSectionUp(course, sIdx)} disabled={sIdx === 0} className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 transition-all cursor-pointer disabled:cursor-not-allowed"><ArrowUp className="w-3 h-3" /></button>}
                                  {onMoveSectionDown && <button type="button" onClick={() => onMoveSectionDown(course, sIdx)} disabled={sIdx === course.sections.length - 1} className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-20 transition-all cursor-pointer disabled:cursor-not-allowed"><ArrowDown className="w-3 h-3" /></button>}
                                </div>
                                <button onClick={() => toggleSection(section.id)} className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-500 transition-colors flex-1 min-w-0 text-left">
                                  {isSectionCollapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px] shrink-0">#{sIdx + 1}</span>
                                  <FolderKanban className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span className="truncate">{section.title}</span>
                                  <span className="text-[10px] text-slate-400 font-normal shrink-0 ml-1">{section.lessons.length} bài</span>
                                </button>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {section.lessons.length > 1 && (
                                  <button
                                    onClick={() => {
                                      const otherSecs = course.sections.filter((s) => s.id !== section.id).map((s) => ({ id: s.id, title: s.title }));
                                      setQuickReorderTarget({
                                        type: "section-lessons",
                                        title: `Sắp xếp ${section.lessons.length} bài học trong: ${section.title}`,
                                        sectionId: section.id,
                                        items: section.lessons.map((l) => ({ id: l.id, title: l.title, subtitle: `${l.resources.length} tài nguyên` })),
                                        otherSections: otherSecs,
                                      });
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 text-[11px] font-bold hover:bg-amber-100 transition-colors"
                                  >
                                    <ListOrdered className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Sắp xếp bài</span>
                                  </button>
                                )}
                                {onEditSection && <button onClick={() => onEditSection(section)} className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"><Edit2 className="w-3 h-3" /></button>}
                                <button onClick={() => onAddLesson(section.id)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-medium transition-colors"><Plus className="w-3 h-3" /> {t("addLesson")}</button>
                                <button onClick={() => onDeleteSection(section)} className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                            {!isSectionCollapsed && (
                              <div className="p-2.5 flex flex-col gap-2">
                                {section.lessons.length === 0 ? (
                                  <div className="text-[11px] text-slate-400 italic px-2 py-2 text-center">Chưa có bài học.</div>
                                ) : (
                                  section.lessons.map((lesson, lIdx) => (
                                    <LessonCard
                                      key={lesson.id}
                                      lesson={lesson}
                                      lIdx={lIdx}
                                      section={section}
                                      isDropTarget={dropTargetLessonId === lesson.id}
                                      isLessonReorderTarget={dropTargetLessonReorderId === lesson.id}
                                      dropSuccessMsg={dropSuccess[lesson.id]}
                                      dropTargetResourceIdx={dropTargetResource?.lessonId === lesson.id ? dropTargetResource.index : null}
                                      onMoveLessonUp={onMoveLessonUp}
                                      onMoveLessonDown={onMoveLessonDown}
                                      onAssignQuiz={onAssignQuiz}
                                      onAddManualResource={onAddManualResource}
                                      onEditLesson={onEditLesson}
                                      onDeleteLesson={onDeleteLesson}
                                      onMoveResourceQuick={handleMoveResourceQuick}
                                      onRemoveResource={onRemoveResource}
                                      onLessonDragStart={handleLessonDragStart}
                                      onLessonDragOver={handleLessonDragOver}
                                      onLessonDrop={handleLessonDrop}
                                      onResourceDragStart={handleResourceDragStart}
                                      onResourceDragOver={handleResourceDragOver}
                                      onResourceDrop={handleResourceDrop}
                                      onDragLeave={handleDragLeave}
                                    />
                                  ))
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

      {/* Quick Reorder Modal */}
      {quickReorderTarget && (
        <QuickReorderModal
          title={quickReorderTarget.title}
          items={quickReorderTarget.items}
          otherSections={quickReorderTarget.otherSections}
          onSave={(newIds) => {
            if (quickReorderTarget.type === "section-lessons" && quickReorderTarget.sectionId && onReorderLessons) {
              onReorderLessons(quickReorderTarget.sectionId, newIds);
            } else if (quickReorderTarget.type === "course-sections" && quickReorderTarget.courseId && onReorderSections) {
              onReorderSections(quickReorderTarget.courseId, newIds);
            }
          }}
          onMoveToSection={(lessonId, targetSectionId) => {
            if (onMoveLesson) {
              onMoveLesson(lessonId, targetSectionId);
            }
          }}
          onClose={() => setQuickReorderTarget(null)}
        />
      )}
    </div>
  );
};

