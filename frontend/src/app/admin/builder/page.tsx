"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { RawDriveTree } from "@/components/builder/RawDriveTree";
import { CuratedCourseTree } from "@/components/builder/CuratedCourseTree";
import { AutoSuggestModal } from "@/components/builder/AutoSuggestModal";
import { ConfirmDeleteModal } from "@/components/builder/ConfirmDeleteModal";
import { AssignQuizModal } from "@/components/builder/AssignQuizModal";
import { DriveNode, Course, Section, Lesson, api, DriveSyncResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Layers,
  Plus,
  X,
  RefreshCw,
  Key,
  CheckCircle2,
} from "lucide-react";

// ─── Drag payload (mirrors RawDriveTree's dataTransfer) ─────────────────────
interface DragPayload {
  driveNodeId: string;
  name: string;
  mimeType: string;
  fileExtension?: string;
  resourceType: number;
}

// ─── Delete state union ──────────────────────────────────────────────────────
type DeleteTarget =
  | { type: "course"; entity: Course }
  | { type: "section"; entity: Section }
  | { type: "lesson"; entity: Lesson };

export default function CourseBuilderPage() {
  const { t } = useI18n();

  // ─── Data ──────────────────────────────────────────────────────────────────
  const [driveNodes, setDriveNodes] = useState<DriveNode[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Create Modals ─────────────────────────────────────────────────────────
  const [autoSuggestNode, setAutoSuggestNode] = useState<DriveNode | null>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState("N5");
  const [addSectionCourseId, setAddSectionCourseId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addLessonSectionId, setAddLessonSectionId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  // ─── Edit Modals ───────────────────────────────────────────────────────────
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editCourseLevel, setEditCourseLevel] = useState("N5");

  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");

  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");

  const [manualResourceLesson, setManualResourceLesson] = useState<Lesson | null>(null);
  const [manualResourceTitle, setManualResourceTitle] = useState("");
  const [manualResourceUrl, setManualResourceUrl] = useState("");
  const [manualResourceType, setManualResourceType] = useState(0);

  // ─── Assign Quiz Modal ───────────────────────────────────────────────────
  const [assignQuizLesson, setAssignQuizLesson] = useState<Lesson | null>(null);

  // ─── Assign Modal (legacy click-to-assign) ─────────────────────────────────
  const [assignDriveNode, setAssignDriveNode] = useState<DriveNode | null>(null);
  const [assignLessonId, setAssignLessonId] = useState("");
  const [assignResourceType, setAssignResourceType] = useState(0);

  // ─── Delete state ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Sync & Auth ──────────────────────────────────────────────────────────
  const [rootFolderId, setRootFolderId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ isAuthenticated: boolean } | null>(null);

  // ─── Load data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nodesData, coursesData, authRes] = await Promise.all([
        api.getDriveNodes(),
        api.getCourses(),
        api.getAuthStatus(),
      ]);
      setDriveNodes(nodesData);
      setCourses(coursesData);
      setAuthStatus(authRes);
    } catch (err) {
      console.error("Failed to load builder data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const savedRoot = localStorage.getItem("nihongo_drive_root_folder_id");
    if (savedRoot) setRootFolderId(savedRoot);
  }, [loadData]);

  // ─── Sync ─────────────────────────────────────────────────────────────────
  const handleTriggerSync = async () => {
    try {
      setSyncing(true);
      if (rootFolderId) {
        localStorage.setItem("nihongo_drive_root_folder_id", rootFolderId);
      }
      const res: DriveSyncResult = await api.triggerDriveSync(rootFolderId);
      if (res.errors && res.errors.length > 0 && res.nodesAdded === 0 && res.nodesUpdated === 0) {
        alert(`Sync Error: ${res.errors.join("\n")}`);
      } else {
        alert(`Drive Sync Completed! Added: ${res.nodesAdded || 0}, Updated: ${res.nodesUpdated || 0}`);
        loadData();
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ─── Create handlers ──────────────────────────────────────────────────────
  const handleCreateCourse = async () => {
    if (!newCourseTitle) return;
    try {
      await api.createCourse({ title: newCourseTitle, jlptLevel: newCourseLevel });
      setNewCourseTitle("");
      setShowAddCourse(false);
      loadData();
    } catch (err: any) {
      alert(`Error creating course: ${err.message}`);
    }
  };

  const handleCreateSection = async () => {
    if (!addSectionCourseId || !newSectionTitle) return;
    try {
      await api.createSection({ courseId: addSectionCourseId, title: newSectionTitle });
      setNewSectionTitle("");
      setAddSectionCourseId(null);
      loadData();
    } catch (err: any) {
      alert(`Error creating section: ${err.message}`);
    }
  };

  const handleCreateLesson = async () => {
    if (!addLessonSectionId || !newLessonTitle) return;
    try {
      await api.createLesson({ sectionId: addLessonSectionId, title: newLessonTitle });
      setNewLessonTitle("");
      setAddLessonSectionId(null);
      loadData();
    } catch (err: any) {
      alert(`Error creating lesson: ${err.message}`);
    }
  };

  // ─── Update handlers ──────────────────────────────────────────────────────
  const handleUpdateCourse = async () => {
    if (!editingCourse || !editCourseTitle) return;
    try {
      await api.updateCourse(editingCourse.id, {
        title: editCourseTitle,
        jlptLevel: editCourseLevel,
      });
      setEditingCourse(null);
      loadData();
    } catch (err: any) {
      alert(`Error updating course: ${err.message}`);
    }
  };

  const handleUpdateSection = async () => {
    if (!editingSection || !editSectionTitle) return;
    try {
      await api.updateSection(editingSection.id, {
        title: editSectionTitle,
      });
      setEditingSection(null);
      loadData();
    } catch (err: any) {
      alert(`Error updating section: ${err.message}`);
    }
  };

  const handleUpdateLesson = async () => {
    if (!editingLesson || !editLessonTitle) return;
    try {
      await api.updateLesson(editingLesson.id, {
        title: editLessonTitle,
      });
      setEditingLesson(null);
      loadData();
    } catch (err: any) {
      alert(`Error updating lesson: ${err.message}`);
    }
  };

  const handleAddManualResource = async () => {
    if (!manualResourceLesson || !manualResourceTitle) return;
    try {
      await api.assignDriveNode({
        lessonId: manualResourceLesson.id,
        driveNodeId: "custom-link-" + Date.now(),
        title: manualResourceTitle,
        resourceType: manualResourceType,
      });
      setManualResourceLesson(null);
      setManualResourceTitle("");
      setManualResourceUrl("");
      loadData();
    } catch (err: any) {
      alert(`Error adding resource: ${err.message}`);
    }
  };

  // ─── Assign (legacy click modal) ──────────────────────────────────────────
  const handleAssignDriveNode = async () => {
    if (!assignDriveNode || !assignLessonId) return;
    try {
      await api.assignDriveNode({
        lessonId: assignLessonId,
        driveNodeId: assignDriveNode.id,
        title: assignDriveNode.name,
        resourceType: assignResourceType,
      });
      setAssignDriveNode(null);
      loadData();
    } catch (err: any) {
      alert(`Error assigning drive node: ${err.message}`);
    }
  };

  const handleRemoveResource = async (resourceId: string) => {
    try {
      await api.removeResource(resourceId);
      loadData();
    } catch (err: any) {
      alert(`Error removing resource: ${err.message}`);
    }
  };

  // ─── Drag & Drop file into Lesson ─────────────────────────────────────────
  const handleDropFile = async (lessonId: string, payload: DragPayload) => {
    try {
      await api.assignDriveNode({
        lessonId,
        driveNodeId: payload.driveNodeId,
        title: payload.name,
        resourceType: payload.resourceType,
      });
      loadData();
    } catch (err: any) {
      alert(`Error assigning file via drag & drop: ${err.message}`);
    }
  };

  // ─── Reorder Lessons (Move Up / Down) ────────────────────────────────────
  const handleMoveLessonUp = async (section: Section, lessonIndex: number) => {
    if (lessonIndex <= 0) return;
    const currentLessons = [...section.lessons];
    const targetLesson = currentLessons[lessonIndex];
    currentLessons.splice(lessonIndex, 1);
    currentLessons.splice(lessonIndex - 1, 0, targetLesson);

    const newIds = currentLessons.map((l) => l.id);
    setCourses((prevCourses) =>
      prevCourses.map((c) => ({
        ...c,
        sections: c.sections.map((s) =>
          s.id === section.id ? { ...s, lessons: currentLessons } : s
        ),
      }))
    );

    try {
      await api.reorderLessons(section.id, newIds);
    } catch (err: any) {
      console.error("Failed to reorder lessons", err);
      await loadData();
    }
  };

  const handleMoveLessonDown = async (section: Section, lessonIndex: number) => {
    if (lessonIndex >= section.lessons.length - 1) return;
    const currentLessons = [...section.lessons];
    const targetLesson = currentLessons[lessonIndex];
    currentLessons.splice(lessonIndex, 1);
    currentLessons.splice(lessonIndex + 1, 0, targetLesson);

    const newIds = currentLessons.map((l) => l.id);
    setCourses((prevCourses) =>
      prevCourses.map((c) => ({
        ...c,
        sections: c.sections.map((s) =>
          s.id === section.id ? { ...s, lessons: currentLessons } : s
        ),
      }))
    );

    try {
      await api.reorderLessons(section.id, newIds);
    } catch (err: any) {
      console.error("Failed to reorder lessons", err);
      await loadData();
    }
  };

  // ─── Delete handlers ──────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "course") {
        await api.deleteCourse(deleteTarget.entity.id);
      } else if (deleteTarget.type === "section") {
        await api.deleteSection(deleteTarget.entity.id);
      } else {
        await api.deleteLesson(deleteTarget.entity.id);
      }
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(`Error deleting: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const allLessons = courses.flatMap((c) =>
    c.sections.flatMap((s) =>
      s.lessons.map((l) => ({
        id: l.id,
        name: `${c.jlptLevel} → ${s.title} → ${l.title}`,
      }))
    )
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header — shrink-0 ensures it never collapses */}
      <Header />

      {/* Main workspace */}
      <main className="flex-1 flex flex-col gap-0 p-4 pt-20 max-w-screen-2xl mx-auto w-full">
        {/* ── Title + Sync Toolbar (shrink-0) ─────────────────────────────── */}
        <div className="shrink-0 flex flex-col gap-3 mb-3">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500 shrink-0" />
                <span className="truncate">{t("navAdmin")} (Course Builder CMS)</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Decoupled: Drive Tree → Course → Section → Lesson → Resource
              </p>
            </div>

            {/* OAuth badge */}
            <div className="flex items-center gap-2 shrink-0">
              {authStatus?.isAuthenticated ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Drive OAuth Connected
                </span>
              ) : (
                <a
                  href="http://localhost:5222/api/auth/google/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-extrabold shadow-md hover:from-orange-700 hover:to-amber-700 transition-all"
                >
                  <Key className="w-3.5 h-3.5" />
                  Kết Nối Google OAuth
                </a>
              )}
            </div>
          </div>

          {/* Sync Toolbar */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                Root ID:
              </span>
              <input
                type="text"
                value={rootFolderId}
                onChange={(e) => setRootFolderId(e.target.value)}
                placeholder="Dán Folder ID từ Google Drive..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-orange-500/50 focus:outline-none min-w-0"
              />
            </div>
            <button
              onClick={handleTriggerSync}
              disabled={syncing}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-md transition-all active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Đang Đồng Bộ..." : "Sync Drive"}
            </button>
          </div>
        </div>

        {/* ── 2-Column Workspace ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[650px] pb-2 min-h-0">
          {/* Left Column: Raw Drive Tree — 5/12 */}
          <div className="lg:col-span-5 h-full flex flex-col min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  Đang tải Drive tree...
                </div>
              </div>
            ) : (
              <RawDriveTree
                nodes={driveNodes}
                onOpenAutoSuggest={(folder) => setAutoSuggestNode(folder)}
                onSelectNodeForAssignment={(node) => setAssignDriveNode(node)}
              />
            )}
          </div>

          {/* Right Column: Curated Course Structure — 7/12 */}
          <div className="lg:col-span-7 h-full flex flex-col min-h-0">
            <CuratedCourseTree
              courses={courses}
              onAddCourse={() => setShowAddCourse(true)}
              onEditCourse={(course) => {
                setEditingCourse(course);
                setEditCourseTitle(course.title);
                setEditCourseLevel(course.jlptLevel);
              }}
              onAddSection={(courseId) => setAddSectionCourseId(courseId)}
              onEditSection={(section) => {
                setEditingSection(section);
                setEditSectionTitle(section.title);
              }}
              onAddLesson={(sectionId) => setAddLessonSectionId(sectionId)}
              onEditLesson={(lesson) => {
                setEditingLesson(lesson);
                setEditLessonTitle(lesson.title);
              }}
              onMoveLessonUp={handleMoveLessonUp}
              onMoveLessonDown={handleMoveLessonDown}
              onAssignQuiz={(lesson) => setAssignQuizLesson(lesson)}
              onAddManualResource={(lesson) => {
                setManualResourceLesson(lesson);
                setManualResourceTitle("");
                setManualResourceUrl("");
                setManualResourceType(0);
              }}
              onRemoveResource={handleRemoveResource}
              onDeleteCourse={(course) => setDeleteTarget({ type: "course", entity: course })}
              onDeleteSection={(section) => setDeleteTarget({ type: "section", entity: section })}
              onDeleteLesson={(lesson) => setDeleteTarget({ type: "lesson", entity: lesson })}
              onDropFile={handleDropFile}
            />
          </div>
        </div>
      </main>

      {/* ════════════════════════════ MODALS ══════════════════════════════════ */}

      {/* Assign Quiz Modal */}
      {assignQuizLesson && (
        <AssignQuizModal
          lesson={assignQuizLesson}
          onClose={() => setAssignQuizLesson(null)}
          onSuccess={loadData}
        />
      )}

      {/* Auto Suggest Modal */}
      {autoSuggestNode && (
        <AutoSuggestModal
          folderNode={autoSuggestNode}
          courses={courses}
          onClose={() => setAutoSuggestNode(null)}
          onSuccess={loadData}
        />
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          variant={deleteTarget.type}
          entityName={deleteTarget.entity.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Add Course Modal */}
      {showAddCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t("addCourse")}</h3>
              <button
                onClick={() => setShowAddCourse(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Course Title
              </label>
              <input
                type="text"
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCourse()}
                placeholder="e.g. N5 Elementary Japanese"
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                {t("jlptLevel")}
              </label>
              <select
                value={newCourseLevel}
                onChange={(e) => setNewCourseLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowAddCourse(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreateCourse}
                disabled={!newCourseTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Save Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Chỉnh Sửa Khóa Học</h3>
              <button
                onClick={() => setEditingCourse(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Tên Khóa Học
              </label>
              <input
                type="text"
                value={editCourseTitle}
                onChange={(e) => setEditCourseTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateCourse()}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                {t("jlptLevel")}
              </label>
              <select
                value={editCourseLevel}
                onChange={(e) => setEditCourseLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingCourse(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleUpdateCourse}
                disabled={!editCourseTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {addSectionCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t("addSection")}</h3>
              <button
                onClick={() => setAddSectionCourseId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Section Title
              </label>
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSection()}
                placeholder="e.g. Chặng 1: Basic Grammar"
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setAddSectionCourseId(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreateSection}
                disabled={!newSectionTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Save Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Chỉnh Sửa Chặng (Section)</h3>
              <button
                onClick={() => setEditingSection(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Tên Chặng
              </label>
              <input
                type="text"
                value={editSectionTitle}
                onChange={(e) => setEditSectionTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateSection()}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingSection(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleUpdateSection}
                disabled={!editSectionTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {addLessonSectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t("addLesson")}</h3>
              <button
                onClick={() => setAddLessonSectionId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Lesson Title
              </label>
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateLesson()}
                placeholder="e.g. Bài 01: Giới thiệu bản thân"
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setAddLessonSectionId(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreateLesson}
                disabled={!newLessonTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Save Lesson
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Chỉnh Sửa Bài Học</h3>
              <button
                onClick={() => setEditingLesson(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Tên Bài Học
              </label>
              <input
                type="text"
                value={editLessonTitle}
                onChange={(e) => setEditLessonTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateLesson()}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingLesson(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleUpdateLesson}
                disabled={!editLessonTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Resource Modal */}
      {manualResourceLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Gắn Tài Nguyên Thủ Công</h3>
              <button
                onClick={() => setManualResourceLesson(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Bài học: <span className="font-semibold text-slate-900 dark:text-white">{manualResourceLesson.title}</span>
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Tên hiển thị tài nguyên
              </label>
              <input
                type="text"
                value={manualResourceTitle}
                onChange={(e) => setManualResourceTitle(e.target.value)}
                placeholder="e.g. Video Bài 01 hoặc Tài liệu PDF"
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Loại tài nguyên
              </label>
              <select
                value={manualResourceType}
                onChange={(e) => setManualResourceType(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value={0}>{t("resourceVideo")}</option>
                <option value={1}>{t("resourceAudio")}</option>
                <option value={2}>{t("resourcePdf")}</option>
                <option value={3}>{t("resourceDoc")}</option>
                <option value={4}>{t("resourceImage")}</option>
                <option value={5}>{t("resourceOther")}</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setManualResourceLesson(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleAddManualResource}
                disabled={!manualResourceTitle}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Thêm Tài Nguyên
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Drive Node Modal (legacy click-to-assign) */}
      {assignDriveNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t("assignToLesson")}</h3>
              <button
                onClick={() => setAssignDriveNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Assigning:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {assignDriveNode.name}
              </span>
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Target Lesson
              </label>
              <select
                value={assignLessonId}
                onChange={(e) => setAssignLessonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">-- Choose Lesson --</option>
                {allLessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Resource Type
              </label>
              <select
                value={assignResourceType}
                onChange={(e) => setAssignResourceType(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value={0}>{t("resourceVideo")}</option>
                <option value={1}>{t("resourceAudio")}</option>
                <option value={2}>{t("resourcePdf")}</option>
                <option value={3}>{t("resourceDoc")}</option>
                <option value={4}>{t("resourceImage")}</option>
                <option value={5}>{t("resourceOther")}</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setAssignDriveNode(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleAssignDriveNode}
                disabled={!assignLessonId}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Assign File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
