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
  HardDrive,
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
  const [scanMode, setScanMode] = useState<"folder" | "local" | "pdf">("folder");

  // Local Folder State
  const [localFolderPath, setLocalFolderPath] = useState<string>("");
  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const [scannedLocalPath, setScannedLocalPath] = useState<string | null>(null);

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
    presetName: "stage-skill-chapter",
    sectionGroupingMode: "combine-stage-skill",
    combineParentStages: true,
    sectionFolderDepth: 2,
    lessonFolderDepth: 3,
    includeLeafFilesAsLessons: true,
    excludeFolderPatterns: ["*lộ trình*", "*lo trinh*", "*file sách*", "*file sach*", "*hướng dẫn*", "*huong dan*"],
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
  const [aiFeedbackRationale, setAiFeedbackRationale] = useState<string | null>(null);

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
    setAiFeedbackRationale(null);
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

  // ── Auto-Detect when Local Folder is scanned ──
  const handleScanLocalFolder = async () => {
    if (!localFolderPath.trim()) {
      setError("Vui lòng nhập đường dẫn thư mục trên máy tính (ví dụ: E:\\TiengNhat\\N3_Shinkanzen).");
      return;
    }

    setIsScanningLocal(true);
    setError(null);
    setAiFeedbackRationale(null);
    try {
      const res = await api.scanLocalFolder({
        localPath: localFolderPath.trim(),
        courseTitle: config.courseTitle || undefined,
        jlptLevel: config.jlptLevel || undefined,
      });

      setSelectedRootFolderId(res.rootFolderNodeId);
      setDetectResult(res.detectionResult);
      setSelectedPreset(res.detectionResult.detectedPreset || "minna-lesson");
      setScannedLocalPath(res.localPath);
      setConfig({
        ...res.detectionResult.suggestedConfig,
        rootFolderNodeId: res.rootFolderNodeId,
      });
    } catch (err: any) {
      setError(err.message || "Lỗi khi quét thư mục trên ổ cứng cục bộ.");
    } finally {
      setIsScanningLocal(false);
    }
  };

  // ── Preset Selection Handler ──
  const handleSelectPreset = (preset: FolderPresetInfo) => {
    setSelectedPreset(preset.presetId);
    const isCompound = preset.presetId === "stage-skill-chapter";
    setConfig((prev) => ({
      ...prev,
      presetName: preset.presetId,
      combineParentStages: isCompound,
      sectionGroupingMode: isCompound ? "combine-stage-skill" : preset.presetId,
      sectionFolderDepth: preset.sectionDepth,
      lessonFolderDepth: preset.lessonDepth,
      includeLeafFilesAsLessons: preset.includeLeafFilesAsLessons,
    }));
  };

  // ── AI Tree Analysis Helper ──
  const handleAiAnalyze = async () => {
    if (!selectedRootFolderId) {
      setError("Vui lòng chọn hoặc quét thư mục nguồn trước.");
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
        combineParentStages: res.combineParentStages ?? prev.combineParentStages,
        sectionGroupingMode: res.sectionGroupingMode ?? prev.sectionGroupingMode,
        aiAnalysisRationale: res.aiAnalysisRationale,
        presetName: "custom",
      }));
      setSelectedPreset("custom");
      if (res.aiAnalysisRationale) {
        setAiFeedbackRationale(res.aiAnalysisRationale);
      }
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

      if (scanMode === "folder" || scanMode === "local") {
        if (!config.rootFolderNodeId) {
          setError(scanMode === "local" ? "Vui lòng quét thư mục ổ cứng cục bộ trước." : "Vui lòng chọn thư mục Drive nguồn.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bento-card relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden p-0">
        
        {/* Header with Step Breadcrumbs (Playful Bento) */}
        <div className="px-6 py-5 bg-[#f8f9ff] dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    AI Auto-Course Builder
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                    Drive Sync & PDF
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Tự động phân tích cây thư mục Google Drive hoặc bóc tách lộ trình PDF theo cấu trúc chuẩn JLPT (N5..N1)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Breadcrumb Steps Indicator (Pills) */}
          <div className="flex items-center gap-2 text-xs font-black pt-1">
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${step === 1 ? "bg-purple-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
              <span className="w-4 h-4 rounded-full bg-white text-purple-700 flex items-center justify-center text-[10px] font-black">1</span>
              <span>Nguồn & Preset</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${step === 2 ? "bg-purple-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
              <span className="w-4 h-4 rounded-full bg-white text-purple-700 flex items-center justify-center text-[10px] font-black">2</span>
              <span>Cấu hình Linh hoạt</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${step === 3 ? "bg-purple-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
              <span className="w-4 h-4 rounded-full bg-white text-purple-700 flex items-center justify-center text-[10px] font-black">3</span>
              <span>Xem trước & Lưu</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 1: Choose Source Folder & Preset Selection
          ════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-5 max-w-2xl mx-auto py-2">
              {/* Mode Selection Tabs */}
              <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setScanMode("folder")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scanMode === "folder"
                      ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FolderTree className="w-4 h-4" />
                  <span>Google Drive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode("local")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scanMode === "local"
                      ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-emerald-500" />
                  <span>Ổ cứng Cục bộ (Local Disk)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode("pdf")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scanMode === "pdf"
                      ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Lộ trình PDF</span>
                </button>
              </div>

              {scanMode === "local" && (
                <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      1. Nhập Đường Dẫn Thư Mục Khóa Học Trên Ổ Cứng
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Hệ thống sẽ đọc trực tiếp video/audio từ ổ cứng máy tính (E:\, D:\, /Users/...). Video sẽ phát tức thì 0ms độ trễ không cần tải lên Google Drive.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <HardDrive className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={localFolderPath}
                          onChange={(e) => setLocalFolderPath(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleScanLocalFolder();
                            }
                          }}
                          placeholder="VD: E:\TiengNhat\N3_Shinkanzen hoặc D:\Khóa học\Minna"
                          className="w-full pl-9 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleScanLocalFolder}
                        disabled={isScanningLocal || !localFolderPath.trim()}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95"
                      >
                        {isScanningLocal ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang Quét...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Quét Thư Mục</span>
                          </>
                        )}
                      </button>
                    </div>
                    {scannedLocalPath && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã quét xong: <span className="font-mono">{scannedLocalPath}</span></span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {scanMode === "folder" && (
                <>
                  {/* Quick-Pick Chips for Top Course Roots */}
                  {topCourseFolders.length > 0 && (
                    <div className="space-y-2 p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-purple-950 dark:text-purple-200 flex items-center gap-1.5 uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>Gợi ý Thư mục Khóa học Nhanh (Click để chọn):</span>
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
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-purple-600 text-white shadow-sm scale-[1.02]"
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
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                        1. Chọn hoặc Tìm kiếm Thư mục Nguồn trên Google Drive
                      </label>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        {categorizedFolders.length} thư mục
                      </span>
                    </div>

                    {/* Live Search Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={folderSearchQuery}
                        onChange={(e) => setFolderSearchQuery(e.target.value)}
                        placeholder="🔍 Tìm nhanh (vd: N2, N3, Dũng Mori, Minna, Bài giảng...)..."
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
                      />
                      {folderSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setFolderSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Hierarchical Indented Select */}
                    <select
                      value={selectedRootFolderId}
                      onChange={(e) => handleFolderSelect(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium font-mono truncate cursor-pointer"
                    >
                      <option value="">-- Chọn thư mục khóa học ({categorizedFolders.length} kết quả) --</option>
                      {categorizedFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.isCourseRoot ? `⭐ ` : `📁 `}{folder.displayName} {folder.rawPath ? `(${folder.rawPath})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(scanMode === "folder" || scanMode === "local") && (
                <>
                  {/* Auto-Detect Status / Analysis Banner */}
                  {(isDetecting || isScanningLocal) && (
                    <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900 flex items-center gap-3 text-xs font-bold text-purple-700 dark:text-purple-300">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-purple-600" />
                      <span>Đang phân tích cấu trúc cây thư mục và độ sâu dữ liệu...</span>
                    </div>
                  )}

                  {detectResult && !isDetecting && !isScanningLocal && (
                    <div className="space-y-4 animate-in fade-in">
                      {detectResult.totalSubFolders === 0 && detectResult.totalFiles === 0 ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                          <div>
                            <p className="font-bold">Thư mục nguồn không có dữ liệu</p>
                            <p className="mt-1 text-[11px] text-amber-600/90 dark:text-amber-400/90">
                              Thư mục này hiện không có thư mục con hoặc file media nào. Vui lòng kiểm tra lại đường dẫn thư mục.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Detection Rationale Banner */}
                          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                            <div className="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                              <span>Tự động nhận diện: {detectResult.rationale}</span>
                            </div>
                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 pl-6">
                              Phát hiện <b>{detectResult.totalSubFolders} thư mục con</b> • <b>{detectResult.totalFiles} file tài liệu/media</b> • Độ sâu tối đa: <b>{detectResult.maxDepth} cấp</b>
                            </p>
                          </div>

                          {/* Presets Cards */}
                          <div>
                            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                              2. Chọn Preset Ánh Xạ (Mapping Preset)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {detectResult.availablePresets.map((preset) => {
                                const isSelected = selectedPreset === preset.presetId;
                                return (
                                  <div
                                    key={preset.presetId}
                                    onClick={() => handleSelectPreset(preset)}
                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                                      isSelected
                                        ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 shadow-sm"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                    <h4 className="text-xs font-black text-slate-900 dark:text-white pr-6">
                                      {preset.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                                      {preset.description}
                                    </p>
                                    <div className="mt-2 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-1 rounded-lg">
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
                                className="w-full flex items-center justify-between p-3.5 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 transition-colors cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <FolderTree className="w-4 h-4 text-purple-600" />
                                  <span>Xem trước Cây thư mục thu nhỏ ({detectResult.folderTreePreview.length} nhánh chính)</span>
                                </span>
                                {showFolderTree ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              {showFolderTree && (
                                <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto space-y-1">
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
              )}

              {scanMode === "pdf" && (
                /* PDF Dropzone Mode */
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      AI Bóc tách Giáo trình / Lộ trình PDF
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      AI sẽ đọc file PDF giáo trình, trích xuất cấu trúc bài học và tự động tìm các file media tương ứng trong kho Drive.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handlePdfDrop}
                    className={`relative border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer ${
                      selectedPdfFile
                        ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-purple-500 bg-slate-50/50 dark:bg-slate-800/40"
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
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {selectedPdfFile.name}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {(selectedPdfFile.size / 1024 / 1024).toFixed(2)} MB • Nhấp để đổi file khác
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-xs">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                          Kéo thả file PDF vào đây hoặc <span className="text-purple-600 dark:text-purple-400 underline">chọn file</span>
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
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
                    ((scanMode === "folder" || scanMode === "local") && (!selectedRootFolderId || isDetecting || isScanningLocal || (detectResult?.totalSubFolders === 0 && detectResult?.totalFiles === 0))) ||
                    (scanMode === "pdf" && (!selectedPdfFile || isDetecting))
                  }
                  onClick={() => {
                    if (scanMode === "local" && !selectedRootFolderId) {
                      setError("Vui lòng nhập đường dẫn và bấm 'Quét Thư Mục' trước.");
                      return;
                    }
                    if (scanMode === "folder" && !selectedRootFolderId) {
                      setError("Vui lòng chọn thư mục Drive nguồn.");
                      return;
                    }
                    if ((scanMode === "folder" || scanMode === "local") && detectResult && detectResult.totalSubFolders === 0 && detectResult.totalFiles === 0) {
                      setError("Thư mục này hiện không có thư mục con hoặc file media nào.");
                      return;
                    }
                    if (scanMode === "pdf" && !selectedPdfFile) {
                      setError("Vui lòng tải lên file PDF lộ trình.");
                      return;
                    }
                    setStep(2);
                  }}
                  className="btn-tactile-purple w-full flex items-center justify-center gap-2 py-3 text-sm font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              {(scanMode === "folder" || scanMode === "local") && (
                <div className="p-4.5 rounded-3xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50 space-y-2.5">
                  <div className="flex items-center gap-2 text-purple-950 dark:text-purple-200">
                    <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                    <span className="text-xs font-black">AI Prompt Helper (Trợ lý Phân tích Cấu Trúc Khóa Học)</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Nhập câu lệnh hướng dẫn bằng tiếng Việt (ví dụ: <i>"Gộp Chặng và Kỹ năng làm Section, mỗi Chương hoặc Dạng bài làm 1 Lesson riêng..."</i>), AI sẽ đọc cây thư mục và tự động cấu hình chuẩn nhất.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPromptInstruction}
                      onChange={(e) => setAiPromptInstruction(e.target.value)}
                      placeholder="Ví dụ: Gộp Chặng 1 + Chữ Hán làm Section, Chương 1..8 làm Lesson..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAiAnalyze}
                      disabled={isAiAnalyzing}
                      className="btn-tactile-purple flex items-center gap-1.5 px-4 py-2 text-xs font-black shrink-0 cursor-pointer disabled:opacity-50"
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

                  {aiFeedbackRationale && (
                    <div className="p-3.5 rounded-2xl bg-purple-100/70 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/70 text-xs text-purple-950 dark:text-purple-200 flex items-start gap-2.5 animate-in fade-in">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-purple-800 dark:text-purple-300">Phản hồi từ AI:</p>
                        <p className="mt-0.5 text-xs text-purple-900 dark:text-purple-200 leading-relaxed font-medium">{aiFeedbackRationale}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Course Title & Level */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    Tên Khóa Học
                  </label>
                  <input
                    type="text"
                    value={config.courseTitle}
                    onChange={(e) => setConfig({ ...config, courseTitle: e.target.value })}
                    placeholder="Ví dụ: Khóa học Tiếng Nhật N3 Dũng Mori"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    Trình độ JLPT
                  </label>
                  <select
                    value={config.jlptLevel}
                    onChange={(e) => setConfig({ ...config, jlptLevel: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold cursor-pointer"
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
                <div className="p-4.5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3.5">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-600" />
                    <span>Cấu hình Phân Cấp Khóa Học (Section & Lesson Mapping)</span>
                  </h4>

                  {/* Primary Compound Mode Toggle */}
                  <label className="flex items-center gap-3 text-xs font-bold text-purple-950 dark:text-purple-300 cursor-pointer bg-purple-50/80 dark:bg-purple-950/40 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800">
                    <input
                      type="checkbox"
                      checked={config.combineParentStages ?? true}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig({
                          ...config,
                          combineParentStages: checked,
                          sectionGroupingMode: checked ? "combine-stage-skill" : "single-folder",
                          sectionFolderDepth: checked ? 2 : 1,
                          lessonFolderDepth: checked ? 3 : 2,
                        });
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 shrink-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-black">⭐ Gộp [Chặng + Kỹ năng] làm Section (Khuyên dùng cho khóa N3/N2)</span>
                      <p className="text-[11px] font-medium text-purple-700/90 dark:text-purple-300/80 mt-0.5">
                        Tự động ghép tên Cấp 1 & Cấp 2 thành <i>"Chặng 1 - Chữ Hán"</i>, <i>"Chặng 1 - Ngữ Pháp"</i>; các folder con bên trong (Chương 1..8, Dạng bài) thành từng Lesson riêng biệt.
                      </p>
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Cấp độ Thư mục làm Section
                      </label>
                      <select
                        value={config.sectionFolderDepth}
                        onChange={(e) => {
                          const depth = parseInt(e.target.value) || 1;
                          setConfig({
                            ...config,
                            sectionFolderDepth: depth,
                            combineParentStages: depth >= 2,
                            sectionGroupingMode: depth >= 2 ? "combine-stage-skill" : "single-folder"
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                      >
                        <option value={2}>Cấp 2 (Gộp Chặng + Kỹ năng)</option>
                        <option value={1}>Cấp 1 (Chặng đơn hoặc Bài học lớn)</option>
                        <option value={3}>Cấp 3 (Cấp sâu hơn)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Cấp độ Thư mục làm Lesson
                      </label>
                      <select
                        value={config.lessonFolderDepth}
                        onChange={(e) => setConfig({ ...config, lessonFolderDepth: parseInt(e.target.value) || 2 })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                      >
                        <option value={3}>Cấp 3 (Chương / Dạng bài: Tanbun, Mondai...)</option>
                        <option value={2}>Cấp 2 (Kỹ năng con hoặc Bài)</option>
                        <option value={4}>Cấp 4 (Cấp sâu hơn)</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.includeLeafFilesAsLessons}
                        onChange={(e) => setConfig({ ...config, includeLeafFilesAsLessons: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Tự động tạo bài học cho các file media lẻ không có thư mục con</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableCrossFolderMatching}
                        onChange={(e) => setConfig({ ...config, enableCrossFolderMatching: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Tự động gom tài liệu tổng hợp ngoài folder bài giảng vào đúng bài học</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 2 Action Buttons */}
              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-tactile-secondary flex items-center gap-1.5 px-4 py-2.5 text-xs font-black cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={loading}
                  className="btn-tactile-purple flex items-center gap-2 px-6 py-2.5 text-xs font-black cursor-pointer disabled:opacity-50"
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
              <div className="p-4.5 rounded-3xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-purple-950 dark:text-purple-200">
                    {scanResult.courseTitle}
                  </h3>
                  <p className="text-xs text-purple-700/90 dark:text-purple-300/80 mt-0.5 font-medium">
                    Phát hiện: <b className="text-purple-950 dark:text-purple-100">{scanResult.totalSections} Section</b> •{" "}
                    <b className="text-purple-950 dark:text-purple-100">{scanResult.totalLessons} Bài học</b> •{" "}
                    <b className="text-purple-950 dark:text-purple-100">{scanResult.totalFilesMatched} File tài liệu/media khớp</b>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="btn-tactile-secondary px-3.5 py-1.5 text-xs font-black cursor-pointer"
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
                          <span className="w-7 h-7 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {section.lessonNumber || secIdx + 1}
                          </span>

                          {editingSecIdx === secIdx ? (
                            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingSecTitle}
                                onChange={(e) => setEditingSecTitle(e.target.value)}
                                className="px-3 py-1 text-xs font-bold rounded-xl border border-purple-500 bg-white dark:bg-slate-900"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveSecTitle(secIdx)}
                                className="btn-tactile-purple px-2.5 py-1 text-[10px] font-black"
                              >
                                Lưu
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {section.title}
                            </span>
                          )}

                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-[10px] font-black text-slate-600 dark:text-slate-300 shrink-0">
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
                              className="p-1 rounded-lg text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                              title="Sửa tên Section"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleSection(secIdx)}
                            className="p-1 text-slate-400 cursor-pointer"
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
                        <div className="p-3.5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                          {section.lessons.map((lesson, lesIdx) => (
                            <div key={lesIdx} className="pt-2.5 first:pt-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-black flex items-center justify-center">
                                    {lesson.flowOrder}
                                  </span>
                                  <span>{lesson.title}</span>
                                  {getSkillBadge(lesson.skill)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold">⏱ {lesson.estimatedDurationMinutes}p</span>
                              </div>

                              {/* Resources List */}
                              {lesson.resources.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic pl-6 font-medium">Chưa có file tài liệu nào khớp</p>
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
                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                              {res.title}
                                            </span>
                                            {res.sourceTier === "CrossFolder" && (
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
                                            className="p-1 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-slate-700"
                                            title="Xem file"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        <button
                                          onClick={() => removeResource(secIdx, lesIdx, resIdx)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Tạo Khóa Học Thành Công!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Đã tạo thành công khóa học <b>"{appliedCourseTitle}"</b> với toàn bộ cây Section, Bài học và Tài liệu liên kết từ Google Drive.
                </p>
              </div>
              <button
                onClick={() => {
                  setStep(1);
                  setScanResult(null);
                  onClose();
                }}
                className="btn-tactile-emerald px-6 py-2.5 text-xs font-black cursor-pointer"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions for Step 3 */}
        {step === 3 && (
          <div className="flex items-center justify-between px-6 py-4 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setStep(2)}
              className="btn-tactile-secondary px-4 py-2 text-xs font-black cursor-pointer"
            >
              Quay lại cấu hình
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="btn-tactile-emerald flex items-center gap-2 px-6 py-2.5 text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu vào Khóa Học...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
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
