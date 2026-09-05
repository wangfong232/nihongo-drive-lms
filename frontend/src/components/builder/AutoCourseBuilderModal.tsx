"use client";

import React, { useState } from "react";
import {
  api,
  AutoBuildScanResult,
  AutoBuildSectionPreview,
  AutoBuildLessonPreview,
  AutoBuildResourcePreview,
  DriveNode,
} from "@/lib/api";
import {
  Sparkles,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Film,
  Headphones,
  FileText,
  HelpCircle,
  Trash2,
  RefreshCw,
  FolderTree,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";

interface AutoCourseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated?: (courseId: string) => void;
  driveNodes?: DriveNode[];
}

export const AutoCourseBuilderModal: React.FC<AutoCourseBuilderModalProps> = ({
  isOpen,
  onClose,
  onCourseCreated,
  driveNodes = [],
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scanMode, setScanMode] = useState<"folder" | "pdf">("folder");
  const [courseTitle, setCourseTitle] = useState("Khóa học Tiếng Nhật N4 Minna no Nihongo");
  const [jlptLevel, setJlptLevel] = useState("N4");
  const [selectedRootFolderId, setSelectedRootFolderId] = useState<string>("");
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<AutoBuildScanResult | null>(null);

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1]));
  const [isApplying, setIsApplying] = useState(false);
  const [appliedCourseTitle, setAppliedCourseTitle] = useState("");

  if (!isOpen) return null;

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    try {
      let res: AutoBuildScanResult;

      if (scanMode === "folder") {
        if (!courseTitle.trim()) {
          setError("Vui lòng nhập tên khóa học.");
          setLoading(false);
          return;
        }

        res = await api.scanAutoBuildCourse({
          courseTitle: courseTitle.trim(),
          jlptLevel,
          rootFolderNodeId: selectedRootFolderId || undefined,
        });
      } else {
        if (!selectedPdfFile) {
          setError("Vui lòng chọn hoặc tải lên file PDF lộ trình / giáo trình.");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedPdfFile);
        if (courseTitle.trim()) formData.append("courseTitle", courseTitle.trim());
        if (jlptLevel) formData.append("jlptLevel", jlptLevel);

        res = await api.scanAutoBuildCourseWithPdf(formData);
      }

      if (!res.sections || res.sections.length === 0) {
        throw new Error(
          scanMode === "folder"
            ? "Không tìm thấy bài học phù hợp trong kho Drive. Vui lòng kiểm tra lại thư mục hoặc JLPT level."
            : "AI không trích xuất được bài học nào từ file PDF. Vui lòng kiểm tra lại nội dung PDF."
        );
      }

      setScanResult(res);
      // Mặc định mở rộng 2 section đầu tiên
      setExpandedSections(new Set([0, 1]));
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Lỗi khi xử lý dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  const handlePdfDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".pdf")) {
        setSelectedPdfFile(file);
        if (!courseTitle || courseTitle === "Khóa học Tiếng Nhật N4 Minna no Nihongo") {
          const autoName = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
          setCourseTitle(autoName);
        }
      } else {
        setError("Chỉ chấp nhận file định dạng .pdf");
      }
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedPdfFile(file);
      if (!courseTitle || courseTitle === "Khóa học Tiếng Nhật N4 Minna no Nihongo") {
        const autoName = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
        setCourseTitle(autoName);
      }
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const removeResource = (secIdx: number, lesIdx: number, resIdx: number) => {
    if (!scanResult) return;
    const newSections = [...scanResult.sections];
    newSections[secIdx].lessons[lesIdx].resources.splice(resIdx, 1);
    setScanResult({
      ...scanResult,
      sections: newSections,
      totalFilesMatched: scanResult.totalFilesMatched - 1,
    });
  };

  const handleApply = async () => {
    if (!scanResult) return;

    setIsApplying(true);
    setError(null);
    try {
      const course = await api.applyAutoBuildCourse({
        courseTitle: scanResult.courseTitle,
        jlptLevel: scanResult.jlptLevel,
        description: `Khóa học chuẩn ${scanResult.jlptLevel} gồm ${scanResult.totalSections} bài học Minna no Nihongo, tạo tự động bởi AI Auto-Builder.`,
        sections: scanResult.sections,
      });

      setAppliedCourseTitle(course.title);
      setStep(3);
      onCourseCreated?.(course.id);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo khóa học.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setScanResult(null);
    setError(null);
    onClose();
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "LessonFolder":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Folder Bài</span>;
      case "CrossFolder":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Tài liệu riêng</span>;
      case "SharedGeneral":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Dùng chung N4</span>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: number) => {
    switch (type) {
      case 0:
        return <Film className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      case 1:
        return <Headphones className="w-3.5 h-3.5 text-violet-500 shrink-0" />;
      case 2:
        return <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 3:
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                AI Auto-Course Builder
              </h2>
              <p className="text-xs text-indigo-100/90">
                Tự động quét kho Drive & sinh cấu trúc Khóa học Chuẩn (5 Lessons / Bài)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 1: Configuration ── */}
          {step === 1 && (
            <div className="space-y-5 max-w-xl mx-auto py-2">
              {/* Mode Selection Tabs */}
              <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setScanMode("folder")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    scanMode === "folder"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FolderTree className="w-4 h-4" />
                  <span>Quét Thư mục Drive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode("pdf")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    scanMode === "pdf"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Bóc tách từ Lộ trình PDF</span>
                </button>
              </div>

              {/* Mode Description Banner */}
              {scanMode === "folder" ? (
                <div className="text-center space-y-1 mb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Tự động nhận diện cấu trúc từ Google Drive
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    AI sẽ tự động nhận diện thư mục từng bài, subfolder kỹ năng (Từ vựng, Ngữ pháp, Choukai...) và cách ly riêng phần Đề thi.
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-1 mb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    AI Bóc tách Giáo trình / Lộ trình PDF
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    AI sẽ đọc file PDF giáo trình, trích xuất cấu trúc bài học và tự động tìm các file media tương ứng trong kho Drive.
                  </p>
                </div>
              )}

              {/* Common Fields */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên Khóa Học
                </label>
                <input
                  type="text"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Ví dụ: Khóa học Tiếng Nhật N4 Minna no Nihongo"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Trình độ JLPT
                  </label>
                  <select
                    value={jlptLevel}
                    onChange={(e) => setJlptLevel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                  >
                    <option value="N5">N5 (Sơ cấp 1)</option>
                    <option value="N4">N4 (Sơ cấp 2)</option>
                    <option value="N3">N3 (Trung cấp)</option>
                    <option value="N2">N2 (Thượng cấp)</option>
                    <option value="N1">N1 (Cao cấp)</option>
                  </select>
                </div>

                {scanMode === "folder" ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Phạm vi quét Drive
                    </label>
                    <select
                      value={selectedRootFolderId}
                      onChange={(e) => setSelectedRootFolderId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium truncate"
                    >
                      <option value="">Toàn bộ kho Drive đã sync</option>
                      {driveNodes
                        .filter((n) => n.nodeType === 0)
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            📁 {folder.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Định dạng giáo trình
                    </label>
                    <div className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      PDF chuẩn (Syllabus / Lộ trình)
                    </div>
                  </div>
                )}
              </div>

              {/* PDF Upload Dropzone for PDF Mode */}
              {scanMode === "pdf" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    File PDF Lộ trình / Giáo trình
                  </label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handlePdfDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                      selectedPdfFile
                        ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handlePdfSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {selectedPdfFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {selectedPdfFile.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {(selectedPdfFile.size / 1024 / 1024).toFixed(2)} MB • Nhấp để đổi file khác
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Kéo thả file PDF vào đây hoặc <span className="text-indigo-600 dark:text-indigo-400 underline">chọn file</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Hỗ trợ file PDF giáo trình Minna, Shinkanzen, Soumatome...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleScan}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{scanMode === "folder" ? "Đang quét kho Drive & phân loại..." : "AI đang đọc PDF & ghép file..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{scanMode === "folder" ? "Bắt đầu Quét & Tự động gom bài" : "Bắt đầu Bóc tách PDF & Ghép file"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Preview & Confirm ── */}
          {step === 2 && scanResult && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-200">
                    {scanResult.courseTitle}
                  </h3>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                    Phát hiện: <b className="text-indigo-900 dark:text-indigo-100">{scanResult.totalSections} Bài học</b> •{" "}
                    <b className="text-indigo-900 dark:text-indigo-100">{scanResult.totalLessons} Kỹ năng</b> •{" "}
                    <b className="text-indigo-900 dark:text-indigo-100">{scanResult.totalFilesMatched} File media khớp</b>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    Quét lại
                  </button>
                </div>
              </div>

              {/* Sections & Lessons Tree */}
              <div className="space-y-3">
                {scanResult.sections.map((section, secIdx) => {
                  const isExpanded = expandedSections.has(secIdx);
                  const totalFilesInSec = section.lessons.reduce((acc, l) => acc + l.resources.length, 0);

                  return (
                    <div
                      key={secIdx}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                    >
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(secIdx)}
                        className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {section.lessonNumber || secIdx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {section.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {totalFilesInSec} files
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {/* Lessons inside Section */}
                      {isExpanded && (
                        <div className="p-3 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                          {section.lessons.map((lesson, lesIdx) => (
                            <div key={lesIdx} className="pt-2.5 first:pt-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold flex items-center justify-center">
                                    {lesson.flowOrder}
                                  </span>
                                  {lesson.title}
                                </span>
                                <span className="text-[10px] text-slate-400">⏱ {lesson.estimatedDurationMinutes}p</span>
                              </div>

                              {/* Resources List */}
                              {lesson.resources.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic pl-6">Chưa có file nào khớp</p>
                              ) : (
                                <div className="space-y-1.5 pl-6">
                                  {lesson.resources.map((res, resIdx) => (
                                    <div
                                      key={res.driveNodeId}
                                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 text-xs group"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {getTypeIcon(res.resourceType)}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                              {res.title}
                                            </span>
                                            {getTierBadge(res.sourceTier)}
                                          </div>
                                          {res.rawPath && (
                                            <span className="block text-[10px] text-slate-400 font-mono truncate">
                                              📂 {res.rawPath}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                          {res.matchScore}%
                                        </span>
                                        {res.webViewLink && (
                                          <a
                                            href={res.webViewLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-slate-700"
                                            title="Xem file"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        <button
                                          onClick={() => removeResource(secIdx, lesIdx, resIdx)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Xóa khỏi bài học"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div className="text-center py-8 space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Tạo Khóa Học Thành Công!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Đã tạo thành công khóa học <b>"{appliedCourseTitle}"</b> với đầy đủ các Section và 5 Lesson chuẩn mực cho từng bài.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === 2 && (
          <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-95"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu vào Khóa Học...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tạo Khóa Học Chuẩn (Apply Course)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoCourseBuilderModal;
