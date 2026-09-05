"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  api,
  AutoBuildScanResult,
  AutoBuildSectionPreview,
  AutoBuildLessonPreview,
  AutoBuildResourcePreview,
  DriveNode,
  AutoDetectFolderResult,
  FolderMappingConfig,
  FolderTreeNode,
  FolderPresetInfo,
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
  Trash2,
  RefreshCw,
  FolderTree,
  ExternalLink,
  UploadCloud,
  Sliders,
  Wand2,
  Settings2,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Folder,
  File,
  Check,
  Edit3,
  Search,
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [scanMode, setScanMode] = useState<"folder" | "pdf">("folder");

  // Step 1 State: Source Selection & Presets
  const [selectedRootFolderId, setSelectedRootFolderId] = useState<string>("");
  const [folderSearchQuery, setFolderSearchQuery] = useState<string>("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<AutoDetectFolderResult | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("minna-lesson");
  const [showFolderTree, setShowFolderTree] = useState(false);

  // Pre-process and categorize folders for quick access & tree hierarchy
  const { topCourseFolders, categorizedFolders } = useMemo(() => {
    const rawFolders = driveNodes.filter((n) => n.nodeType === 0);

    const naturalCompare = (a: string, b: string) =>
      a.replace(/\d+/g, (m) => m.padStart(10, "0")).localeCompare(
        b.replace(/\d+/g, (m) => m.padStart(10, "0")),
        undefined,
        { numeric: true, sensitivity: "base" }
      );

    const isTopCourse = (f: DriveNode) => {
      const name = f.name.toLowerCase();
      const depth = (f.rawPath || "").split("/").filter(Boolean).length;
      return (
        /\b(n[1-5]|minna|shinkanzen|soumatome|mimikara|marugoto|dung mori|dũng mori|khoa hoc|khóa học)\b/i.test(name) ||
        (depth <= 2 && !/\b(chuong|chương|bai|bài|mondai|audio|de thi|đề thi)\b/i.test(name))
      );
    };

    const topList = rawFolders
      .filter(isTopCourse)
      .sort((a, b) => naturalCompare(a.name, b.name));

    const allFormatted = rawFolders
      .map((f) => {
        const segs = (f.rawPath || f.name).split("/").filter(Boolean);
        const depth = Math.max(0, segs.length - 1);
        const indent = depth > 0 ? "　".repeat(depth) + "└─ " : "";
        return {
          ...f,
          depth,
          displayName: `${indent}${f.name}`,
          isCourseRoot: isTopCourse(f),
        };
      })
      .sort((a, b) => {
        const pA = a.rawPath || a.name;
        const pB = b.rawPath || b.name;
        return naturalCompare(pA, pB);
      });

    const query = folderSearchQuery.trim().toLowerCase();
    const filteredAll = query
      ? allFormatted.filter(
          (f) =>
            f.name.toLowerCase().includes(query) ||
            (f.rawPath || "").toLowerCase().includes(query)
        )
      : allFormatted;

    return {
      topCourseFolders: topList,
      categorizedFolders: filteredAll,
    };
  }, [driveNodes, folderSearchQuery]);

  // PDF Mode State
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

  // Step 2 State: Flexible Mapping Config
  const [config, setConfig] = useState<FolderMappingConfig>({
    rootFolderNodeId: "",
    courseTitle: "Khóa học Tiếng Nhật",
    jlptLevel: "N4",
    presetName: "minna-lesson",
    sectionFolderDepth: 1,
    lessonFolderDepth: 2,
    includeLeafFilesAsLessons: true,
    excludeFolderPatterns: ["*lộ trình*", "*lo trinh*", "*file sách*", "*file sach*", "*hướng dẫn*"],
    excludeFileExtensions: [".exe", ".zip", ".rar", ".txt", ".ini"],
    skillKeywordRules: {
      "chu han": "Kanji",
      "chữ hán": "Kanji",
      "kanji": "Kanji",
      "tu vung": "Vocabulary",
      "từ vựng": "Vocabulary",
      "kotoba": "Vocabulary",
      "ngu phap": "Grammar",
      "ngữ pháp": "Grammar",
      "bunpou": "Grammar",
      "nghe": "Choukai",
      "choukai": "Choukai",
      "mondai": "Choukai",
      "doc": "Dokkai",
      "đọc": "Dokkai",
      "dokkai": "Dokkai",
      "tanbun": "Dokkai",
      "chuubun": "Dokkai",
      "choubun": "Dokkai",
      "kensaku": "Dokkai",
      "hoi thoai": "Kaiwa",
      "hội thoại": "Kaiwa",
      "de thi": "Quiz",
      "thi thu": "Quiz",
      "luyen de": "Quiz",
      "test": "Quiz",
    },
    defaultLessonDurationMinutes: 45,
    enableCrossFolderMatching: true,
  });

  // AI Prompt Helper State
  const [aiPromptInstruction, setAiPromptInstruction] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Step 3 State: Course Preview & Confirm
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<AutoBuildScanResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1]));
  const [isApplying, setIsApplying] = useState(false);
  const [appliedCourseTitle, setAppliedCourseTitle] = useState("");

  // Edit inline states in Step 3
  const [editingSecIdx, setEditingSecIdx] = useState<number | null>(null);
  const [editingSecTitle, setEditingSecTitle] = useState("");

  if (!isOpen) return null;

  // ── Auto-Detect when Root Folder is chosen ──
  const handleFolderSelect = async (folderId: string) => {
    setSelectedRootFolderId(folderId);
    if (!folderId) {
      setDetectResult(null);
      return;
    }

    setIsDetecting(true);
    setError(null);
    try {
      const res = await api.detectFolderStructure(folderId);
      setDetectResult(res);
      setSelectedPreset(res.detectedPreset);

      setConfig({
        ...res.suggestedConfig,
        rootFolderNodeId: folderId,
      });
    } catch (err: any) {
      setError(err.message || "Lỗi khi phân tích thư mục Drive.");
    } finally {
      setIsDetecting(false);
    }
  };

  // ── Preset Selection Handler ──
  const handleSelectPreset = (preset: FolderPresetInfo) => {
    setSelectedPreset(preset.presetId);
    setConfig((prev) => ({
      ...prev,
      presetName: preset.presetId,
      sectionFolderDepth: preset.sectionDepth,
      lessonFolderDepth: preset.lessonDepth,
      includeLeafFilesAsLessons: preset.includeLeafFilesAsLessons,
    }));
  };

  // ── AI Tree Analysis Helper ──
  const handleAiAnalyze = async () => {
    if (!selectedRootFolderId) {
      setError("Vui lòng chọn thư mục nguồn trước.");
      return;
    }

    setIsAiAnalyzing(true);
    setError(null);
    try {
      const res = await api.analyzeFolderTreeWithAi({
        rootFolderId: selectedRootFolderId,
        customPromptInstruction: aiPromptInstruction.trim() || undefined,
      });

      setConfig((prev) => ({
        ...prev,
        sectionFolderDepth: res.sectionFolderDepth,
        lessonFolderDepth: res.lessonFolderDepth,
        includeLeafFilesAsLessons: res.includeLeafFilesAsLessons,
        presetName: "custom",
      }));
      setSelectedPreset("custom");
    } catch (err: any) {
      setError(err.message || "Lỗi khi gọi AI phân tích cây thư mục.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // ── Generate Preview (Step 2 -> Step 3) ──
  const handleGeneratePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      let res: AutoBuildScanResult;

      if (scanMode === "folder") {
        if (!config.rootFolderNodeId) {
          setError("Vui lòng chọn thư mục Drive nguồn.");
          setLoading(false);
          return;
        }
        res = await api.generateFolderCoursePreview(config);
      } else {
        if (!selectedPdfFile) {
          setError("Vui lòng chọn hoặc tải lên file PDF lộ trình.");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedPdfFile);
        if (config.courseTitle.trim()) formData.append("courseTitle", config.courseTitle.trim());
        if (config.jlptLevel) formData.append("jlptLevel", config.jlptLevel);

        res = await api.scanAutoBuildCourseWithPdf(formData);
      }

      if (!res.sections || res.sections.length === 0) {
        throw new Error("Không trích xuất được bài học nào. Hãy kiểm tra lại cấu hình độ sâu hoặc bộ lọc loại trừ.");
      }

      setScanResult(res);
      setExpandedSections(new Set([0, 1]));
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo bản xem trước khóa học.");
    } finally {
      setLoading(false);
    }
  };

  // ── Apply Course (Step 3 -> Step 4) ──
  const handleApply = async () => {
    if (!scanResult) return;

    setIsApplying(true);
    setError(null);
    try {
      const course = await api.applyFolderCourse({
        courseTitle: scanResult.courseTitle,
        jlptLevel: scanResult.jlptLevel,
        description: `Khóa học ${scanResult.jlptLevel} gồm ${scanResult.totalSections} phần học, tạo tự động bởi Flexible Folder Course Builder.`,
        sections: scanResult.sections,
      });

      setAppliedCourseTitle(course.title);
      setStep(4);
      onCourseCreated?.(course.id);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo khóa học.");
    } finally {
      setIsApplying(false);
    }
  };

  const handlePdfDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".pdf")) {
        setSelectedPdfFile(file);
        const autoName = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
        setConfig((prev) => ({ ...prev, courseTitle: autoName }));
      } else {
        setError("Chỉ chấp nhận file định dạng .pdf");
      }
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedPdfFile(file);
      const autoName = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
      setConfig((prev) => ({ ...prev, courseTitle: autoName }));
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

  const handleSaveSecTitle = (secIdx: number) => {
    if (!scanResult || !editingSecTitle.trim()) return;
    const newSections = [...scanResult.sections];
    newSections[secIdx].title = editingSecTitle.trim();
    setScanResult({ ...scanResult, sections: newSections });
    setEditingSecIdx(null);
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

  const getSkillBadge = (skill: string) => {
    const s = skill.toLowerCase();
    if (s.includes("kanji") || s.includes("hán"))
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Kanji</span>;
    if (s.includes("vocab") || s.includes("vựng"))
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Từ Vựng</span>;
    if (s.includes("gram") || s.includes("pháp"))
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Ngữ Pháp</span>;
    if (s.includes("choukai") || s.includes("nghe"))
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Choukai</span>;
    if (s.includes("dokkai") || s.includes("đọc"))
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">Dokkai</span>;
    if (s.includes("quiz") || s.includes("đề") || s.includes("thi"))
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Đề Thi</span>;

    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">{skill || "Tổng hợp"}</span>;
  };

  // Render collapsible folder tree preview in Step 1
  const renderFolderTreeNode = (node: FolderTreeNode, depth: number = 0) => (
    <div key={node.id} className="text-xs" style={{ paddingLeft: `${depth * 14}px` }}>
      <div className="flex items-center gap-1.5 py-1 text-slate-700 dark:text-slate-300 font-mono">
        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="truncate">{node.name}</span>
        <span className="text-[10px] text-slate-400 shrink-0">
          ({node.subFolderCount > 0 ? `${node.subFolderCount} sub` : ""}{node.fileCount > 0 ? ` • ${node.fileCount} files` : ""})
        </span>
      </div>
      {node.children && node.children.map((c) => renderFolderTreeNode(c, depth + 1))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        
        {/* Header with Step Breadcrumbs */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight">
                  Flexible Folder-to-Course Builder
                </h2>
                <p className="text-xs text-indigo-100/90">
                  Dựng Khóa học Thông minh từ Google Drive theo mọi mô hình (N5..N1)
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

          {/* Breadcrumb Steps Indicator */}
          <div className="flex items-center gap-2 text-xs font-bold pt-1">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${step === 1 ? "bg-white text-indigo-700 shadow-xs" : "bg-white/20 text-white"}`}>
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
              <span>Nguồn & Preset</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/60" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${step === 2 ? "bg-white text-indigo-700 shadow-xs" : "bg-white/20 text-white"}`}>
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
              <span>Cấu hình Linh hoạt</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/60" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${step === 3 ? "bg-white text-indigo-700 shadow-xs" : "bg-white/20 text-white"}`}>
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
              <span>Xem trước & Lưu</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 1: Choose Source Folder & Preset Selection
          ════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-5 max-w-2xl mx-auto py-2">
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
                  <span>Quét Thư mục Google Drive</span>
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
                  <span>Bóc tách Lộ trình PDF</span>
                </button>
              </div>

              {scanMode === "folder" ? (
                <>
                  {/* Quick-Pick Chips for Top Course Roots */}
                  {topCourseFolders.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>Gợi ý Thư mục Khóa học Nhanh (Click để chọn ngay):</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topCourseFolders.slice(0, 10).map((folder) => {
                          const isSelected = selectedRootFolderId === folder.id;
                          return (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => handleFolderSelect(folder.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 scale-[1.02]"
                                  : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs"
                              }`}
                            >
                              <Folder className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-amber-500"}`} />
                              <span>{folder.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Folder Selection & Search Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        1. Chọn hoặc Tìm kiếm Thư mục Nguồn trên Google Drive
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {categorizedFolders.length} thư mục
                      </span>
                    </div>

                    {/* Live Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={folderSearchQuery}
                        onChange={(e) => setFolderSearchQuery(e.target.value)}
                        placeholder="🔍 Tìm nhanh (vd: N2, N3, Dũng Mori, Minna, Bài giảng...)..."
                        className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      {folderSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setFolderSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Hierarchical Indented Select */}
                    <select
                      value={selectedRootFolderId}
                      onChange={(e) => handleFolderSelect(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono truncate"
                    >
                      <option value="">-- Chọn thư mục khóa học ({categorizedFolders.length} kết quả) --</option>
                      {categorizedFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.isCourseRoot ? `⭐ ` : `📁 `}{folder.displayName} {folder.rawPath ? `(${folder.rawPath})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Auto-Detect Status / Analysis Banner */}
                  {isDetecting && (
                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center gap-3 text-xs text-indigo-600 dark:text-indigo-400">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Đang phân tích cấu trúc cây thư mục và độ sâu dữ liệu...</span>
                    </div>
                  )}

                  {detectResult && !isDetecting && (
                    <div className="space-y-4 animate-in fade-in">
                      {detectResult.totalSubFolders === 0 && detectResult.totalFiles === 0 ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                          <div>
                            <p className="font-bold">Thư mục nguồn không có dữ liệu</p>
                            <p className="mt-1 text-[11px] text-amber-600/90 dark:text-amber-400/90">
                              Thư mục này hiện không có thư mục con hoặc file media nào. Vui lòng kiểm tra lại quá trình Sync Drive hoặc chọn thư mục khác.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Detection Rationale Banner */}
                          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Tự động nhận diện: {detectResult.rationale}</span>
                            </div>
                            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 pl-6">
                              Phát hiện <b>{detectResult.totalSubFolders} thư mục con</b> • <b>{detectResult.totalFiles} file tài liệu/media</b> • Độ sâu tối đa: <b>{detectResult.maxDepth} cấp</b>
                            </p>
                          </div>

                          {/* Presets Cards */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                              2. Chọn Preset Ánh Xạ (Mapping Preset)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {detectResult.availablePresets.map((preset) => {
                                const isSelected = selectedPreset === preset.presetId;
                                return (
                                  <div
                                    key={preset.presetId}
                                    onClick={() => handleSelectPreset(preset)}
                                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                                      isSelected
                                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-sm"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white pr-6">
                                      {preset.name}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                      {preset.description}
                                    </p>
                                    <div className="mt-2 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">
                                      Cấu trúc: {preset.samplePathPattern}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Collapsible Folder Tree Preview */}
                          {detectResult.folderTreePreview.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setShowFolderTree(!showFolderTree)}
                                className="w-full flex items-center justify-between p-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <FolderTree className="w-4 h-4 text-indigo-600" />
                                  <span>Xem trước Cây thư mục thu nhỏ ({detectResult.folderTreePreview.length} nhánh chính)</span>
                                </span>
                                {showFolderTree ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              {showFolderTree && (
                                <div className="p-3 border-t border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto space-y-1">
                                  {detectResult.folderTreePreview.map((node) => renderFolderTreeNode(node))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* PDF Dropzone Mode */
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      AI Bóc tách Giáo trình / Lộ trình PDF
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      AI sẽ đọc file PDF giáo trình, trích xuất cấu trúc bài học và tự động tìm các file media tương ứng trong kho Drive.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handlePdfDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
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

              {/* Step 1 Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={
                    (scanMode === "folder" && (!selectedRootFolderId || isDetecting || (detectResult?.totalSubFolders === 0 && detectResult?.totalFiles === 0))) ||
                    (scanMode === "pdf" && (!selectedPdfFile || isDetecting))
                  }
                  onClick={() => {
                    if (scanMode === "folder" && !selectedRootFolderId) {
                      setError("Vui lòng chọn thư mục Drive nguồn.");
                      return;
                    }
                    if (scanMode === "folder" && detectResult && detectResult.totalSubFolders === 0 && detectResult.totalFiles === 0) {
                      setError("Thư mục này hiện không có thư mục con hoặc file media nào.");
                      return;
                    }
                    if (scanMode === "pdf" && !selectedPdfFile) {
                      setError("Vui lòng tải lên file PDF lộ trình.");
                      return;
                    }
                    setStep(2);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
                >
                  <span>Tiếp tục Cấu hình Ánh Xạ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 2: Flexible Mapping Configuration & AI Prompt Helper
          ════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-5 max-w-2xl mx-auto py-2">
              {/* ✨ AI Prompt Helper Card */}
              {scanMode === "folder" && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-2 text-indigo-950 dark:text-indigo-200">
                    <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                    <span className="text-xs font-extrabold">AI Prompt Helper (Xử lý Cấu Trúc Khó / Độc Lạ)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2.5">
                    Nếu cây thư mục của bạn có cách tổ chức đặc thù, hãy nhập ghi chú để AI Gemini tự động đọc JSON cây thư mục và thiết lập cấu hình chuẩn xác nhất.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPromptInstruction}
                      onChange={(e) => setAiPromptInstruction(e.target.value)}
                      placeholder="Ví dụ: Lấy folder Chặng làm Section, folder Chữ hán/Ngữ pháp làm Lesson..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleAiAnalyze}
                      disabled={isAiAnalyzing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shrink-0 shadow-sm"
                    >
                      {isAiAnalyzing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>AI đang đọc...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>AI Phân Tích</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Course Title & Level */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tên Khóa Học
                  </label>
                  <input
                    type="text"
                    value={config.courseTitle}
                    onChange={(e) => setConfig({ ...config, courseTitle: e.target.value })}
                    placeholder="Ví dụ: Khóa học Tiếng Nhật N4 Minna no Nihongo"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Trình độ JLPT
                  </label>
                  <select
                    value={config.jlptLevel}
                    onChange={(e) => setConfig({ ...config, jlptLevel: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                  >
                    <option value="N5">N5 (Sơ cấp 1)</option>
                    <option value="N4">N4 (Sơ cấp 2)</option>
                    <option value="N3">N3 (Trung cấp)</option>
                    <option value="N2">N2 (Thượng cấp)</option>
                    <option value="N1">N1 (Cao cấp)</option>
                  </select>
                </div>
              </div>

              {/* Depth Controls */}
              {scanMode === "folder" && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>Cấu hình Cấp Độ Thư Mục (Folder Depth Mapping)</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cấp độ Thư mục làm Section (Chương / Chặng / Bài)
                      </label>
                      <select
                        value={config.sectionFolderDepth}
                        onChange={(e) => setConfig({ ...config, sectionFolderDepth: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      >
                        <option value={1}>Cấp 1 (Thư mục con trực tiếp của Root)</option>
                        <option value={2}>Cấp 2 (Ví dụ: 01. Bài giảng / Bài 26)</option>
                        <option value={3}>Cấp 3 (Thư mục con cấp sâu)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cấp độ Thư mục làm Lesson (Bài học / Kỹ năng)
                      </label>
                      <select
                        value={config.lessonFolderDepth}
                        onChange={(e) => setConfig({ ...config, lessonFolderDepth: parseInt(e.target.value) || 2 })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      >
                        <option value={2}>Cấp 2 (Ví dụ: 1. Chữ hán, 2. Ngữ pháp)</option>
                        <option value={3}>Cấp 3 (Ví dụ: Chặng 1 / Chữ hán / Chương 1)</option>
                        <option value={4}>Cấp 4 (Cấp sâu hơn)</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.includeLeafFilesAsLessons}
                        onChange={(e) => setConfig({ ...config, includeLeafFilesAsLessons: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Tự động biến các file media lẻ không có subfolder thành từng Bài học độc lập</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableCrossFolderMatching}
                        onChange={(e) => setConfig({ ...config, enableCrossFolderMatching: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Tự động gộp tài liệu tổng hợp ngoài folder bài giảng (vd: <i>Tổng hợp ngữ pháp bài 25-50 minna</i>) vào đúng Bài học</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 2 Action Buttons */}
              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang xây dựng bản xem trước...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Xem trước Cây Khóa Học</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 3: Interactive Course Tree Preview & Edit
          ════════════════════════════════════════════════════════════ */}
          {step === 3 && scanResult && (
            <div className="space-y-4">
              {/* Summary Header */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-200">
                    {scanResult.courseTitle}
                  </h3>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                    Phát hiện: <b className="text-indigo-900 dark:text-indigo-100">{scanResult.totalSections} Section</b> •{" "}
                    <b className="text-indigo-900 dark:text-indigo-100">{scanResult.totalLessons} Bài học</b> •{" "}
                    <b className="text-indigo-900 dark:text-indigo-100">{scanResult.totalFilesMatched} File tài liệu/media khớp</b>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    Chỉnh Cấu Hình
                  </button>
                </div>
              </div>

              {/* Sections & Lessons Accordion List */}
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
                      <div className="flex items-center justify-between p-3.5 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/70 transition-colors">
                        <div
                          onClick={() => toggleSection(secIdx)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {section.lessonNumber || secIdx + 1}
                          </span>

                          {editingSecIdx === secIdx ? (
                            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingSecTitle}
                                onChange={(e) => setEditingSecTitle(e.target.value)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-indigo-500 bg-white dark:bg-slate-900"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveSecTitle(secIdx)}
                                className="px-2 py-1 rounded-md bg-indigo-600 text-white text-[10px] font-bold"
                              >
                                Lưu
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                              {section.title}
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {totalFilesInSec} files
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {editingSecIdx !== secIdx && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSecIdx(secIdx);
                                setEditingSecTitle(section.title);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Sửa tên Section"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleSection(secIdx)}
                            className="p-1 text-slate-400"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

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
                                  <span>{lesson.title}</span>
                                  {getSkillBadge(lesson.skill)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">⏱ {lesson.estimatedDurationMinutes}p</span>
                              </div>

                              {/* Resources List */}
                              {lesson.resources.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic pl-6">Chưa có file tài liệu nào khớp</p>
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
                                            {res.sourceTier === "CrossFolder" && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                Tài liệu tổng hợp
                                              </span>
                                            )}
                                          </div>
                                          {res.rawPath && (
                                            <span className="block text-[10px] text-slate-400 font-mono truncate">
                                              📂 {res.rawPath}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
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

          {/* ═══════════════════════════════════════════════════════════
              STEP 4: Success Completion
          ════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="text-center py-8 space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Tạo Khóa Học Thành Công!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Đã tạo thành công khóa học <b>"{appliedCourseTitle}"</b> với toàn bộ cây Section, Bài học và Tài liệu liên kết từ Google Drive.
                </p>
              </div>
              <button
                onClick={() => {
                  setStep(1);
                  setScanResult(null);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions for Step 3 */}
        {step === 3 && (
          <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Quay lại cấu hình
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-95"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu vào Khóa Học...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận Tạo Khóa Học (Apply Course)</span>
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
