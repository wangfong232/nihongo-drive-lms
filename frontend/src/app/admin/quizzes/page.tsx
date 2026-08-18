"use client";

import React, { useEffect, useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Quiz, QuizQuestion, Course, api, QuizQuestionPayload } from "@/lib/api";
import { DriveAudioPlayer } from "@/components/common/DriveAudioPlayer";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckSquare,
  ListOrdered,
  Volume2,
  X,
  Clock,
  Award,
  BookOpen,
  Filter,
  PlayCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowLeft,
  ChevronUp,
  FolderKanban,
  Headphones,
} from "lucide-react";

export default function AdminQuizzesPage() {
  const { t } = useI18n();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Quiz to manage its questions (Master-Detail)
  const [activeSelectedQuizId, setActiveSelectedQuizId] = useState<string | null>(null);

  // Filter tabs
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<number | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Quiz Modal State (Create / Edit)
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizType, setQuizType] = useState<number>(2); // Default to PracticeTest (JLPT Mock)
  const [passPercentage, setPassPercentage] = useState(60);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>(105);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);

  // Question Modal State (Create / Edit)
  const [activeQuizForQuestion, setActiveQuizForQuestion] = useState<Quiz | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [questionType, setQuestionType] = useState<number>(0);
  const [promptText, setPromptText] = useState("");
  const [points, setPoints] = useState(2);
  const [explanationText, setExplanationText] = useState("");

  // Question Type Payloads
  const [mcOptions, setMcOptions] = useState<string[]>(["", "", "", ""]);
  const [mcCorrectIndex, setMcCorrectIndex] = useState(0);
  const [fillBlankAnswer, setFillBlankAnswer] = useState("");
  const [listeningAudioUrl, setListeningAudioUrl] = useState("");
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // ─── Batch Import State for Quizzes & Questions ───────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetQuizId, setImportTargetQuizId] = useState<string>("new");
  const [importNewQuizTitle, setImportNewQuizTitle] = useState("");
  const [importNewQuizLevel, setImportNewQuizLevel] = useState("N5");
  const [importNewQuizDuration, setImportNewQuizDuration] = useState(105);
  const [importNewQuizPass, setImportNewQuizPass] = useState(60);
  const [importRawText, setImportRawText] = useState("");
  const [parsedImportQuestions, setParsedImportQuestions] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const loadData = async () => {
    try {
      setLoading(true);
      const [qData, cData] = await Promise.all([api.getQuizzes(), api.getCourses()]);
      setQuizzes(qData);
      setCourses(cData);
    } catch (err) {
      console.error("Failed to load quizzes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Quiz Create / Edit ───────────────────────────────────────────────────
  const handleOpenCreateQuiz = () => {
    setEditingQuiz(null);
    setQuizTitle("");
    setQuizDescription("");
    setQuizType(2); // JLPT Practice Test default
    setPassPercentage(60);
    setTimeLimitMinutes(105);
    setSelectedLessonId("");
    setShuffleQuestions(false);
    setShowQuizModal(true);
  };

  const handleOpenEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setQuizTitle(quiz.title);
    setQuizDescription(quiz.description || "");
    setQuizType(quiz.quizType ?? 0);
    setPassPercentage(quiz.passPercentage ?? 60);
    setTimeLimitMinutes(quiz.timeLimitMinutes || 105);
    setSelectedLessonId(quiz.lessonId || "");
    setShuffleQuestions(quiz.shuffleQuestions ?? false);
    setShowQuizModal(true);
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle.trim()) {
      alert("Vui lòng nhập Tiêu đề Đề Thi / Quiz.");
      return;
    }

    try {
      if (editingQuiz) {
        await api.updateQuiz(editingQuiz.id, {
          title: quizTitle,
          description: quizDescription,
          quizType,
          passPercentage,
          timeLimitMinutes: Number(timeLimitMinutes) || undefined,
          lessonId: selectedLessonId || undefined,
          shuffleQuestions,
        });
      } else {
        const created = await api.createQuiz({
          title: quizTitle,
          description: quizDescription,
          quizType,
          passPercentage,
          timeLimitMinutes: Number(timeLimitMinutes) || undefined,
          lessonId: selectedLessonId || undefined,
          shuffleQuestions,
        });
        setActiveSelectedQuizId(created.id);
      }

      setShowQuizModal(false);
      loadData();
    } catch (err: any) {
      alert(`Lỗi lưu đề thi: ${err.message}`);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa bộ đề này và tất cả các câu hỏi liên quan?")) {
      await api.deleteQuiz(id);
      if (activeSelectedQuizId === id) setActiveSelectedQuizId(null);
      loadData();
    }
  };

  // ─── Question Create / Edit & Answer Updates ──────────────────────────────
  const handleOpenAddQuestion = (quiz: Quiz) => {
    setActiveQuizForQuestion(quiz);
    setEditingQuestion(null);
    setQuestionType(0);
    setPromptText("");
    setPoints(2);
    setExplanationText("");
    setMcOptions(["", "", "", ""]);
    setMcCorrectIndex(0);
    setFillBlankAnswer("");
    setListeningAudioUrl("");
  };

  const handleOpenEditQuestion = (quiz: Quiz, question: QuizQuestion) => {
    setActiveQuizForQuestion(quiz);
    setEditingQuestion(question);
    setQuestionType(question.questionType ?? 0);
    setPromptText(question.prompt);
    setPoints(question.points ?? 1);

    try {
      const payload = JSON.parse(question.payloadJson || "{}");
      setExplanationText(payload.explanation || "");
      if (payload.options && Array.isArray(payload.options)) {
        const opts = [...payload.options];
        while (opts.length < 4) opts.push("");
        setMcOptions(opts);
        setMcCorrectIndex(payload.correctIndex ?? 0);
      } else {
        setMcOptions(["", "", "", ""]);
        setMcCorrectIndex(0);
      }

      if (payload.acceptableAnswers && Array.isArray(payload.acceptableAnswers)) {
        setFillBlankAnswer(payload.acceptableAnswers.join(", "));
      } else {
        setFillBlankAnswer("");
      }

      setListeningAudioUrl(payload.audioUrl || "");
    } catch {
      setMcOptions(["", "", "", ""]);
      setMcCorrectIndex(0);
      setFillBlankAnswer("");
      setExplanationText("");
    }
  };

  // ─── Local Audio Upload Handler ───────────────────────────────────────────
  const handleLocalAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAudio(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:5222/api/audio/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Tải lên thất bại");
      }

      const data = await res.json();
      setListeningAudioUrl(data.fileUrl);
      alert(`Đã tải lên tệp âm thanh thành công: ${file.name}`);
    } catch (err: any) {
      alert(`Lỗi upload audio: ${err.message}`);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!activeQuizForQuestion || !promptText.trim()) {
      alert("Vui lòng nhập Nội dung câu hỏi (Prompt).");
      return;
    }

    let payload: QuizQuestionPayload = {
      explanation: explanationText.trim(),
    };

    if (questionType === 0 || questionType === 6) {
      // Multiple Choice or Listening Comprehension
      const validOptions = mcOptions.map((o) => o.trim()).filter((o) => o.length > 0);
      if (validOptions.length < 2) {
        alert("Vui lòng nhập ít nhất 2 đáp án lựa chọn.");
        return;
      }
      payload.options = mcOptions.map((o) => o.trim());
      payload.correctIndex = mcCorrectIndex;
      if (questionType === 6 && listeningAudioUrl.trim()) {
        payload.audioUrl = listeningAudioUrl.trim();
      }
    } else if (questionType === 2) {
      // Fill in the Blank
      const answers = fillBlankAnswer.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      if (answers.length === 0) {
        alert("Vui lòng nhập ít nhất một đáp án chấp nhận được (ngăn cách bằng dấu phẩy).");
        return;
      }
      payload.acceptableAnswers = answers;
    }

    try {
      if (editingQuestion) {
        await api.updateQuizQuestion(editingQuestion.id, {
          quizId: activeQuizForQuestion.id,
          questionType,
          prompt: promptText.trim(),
          points: Number(points) || 1,
          displayOrder: editingQuestion.displayOrder || 1,
          payloadJson: JSON.stringify(payload),
        });
      } else {
        const nextOrder = (activeQuizForQuestion.questions?.length || 0) + 1;
        await api.createQuizQuestion({
          quizId: activeQuizForQuestion.id,
          questionType,
          prompt: promptText.trim(),
          points: Number(points) || 1,
          displayOrder: nextOrder,
          payloadJson: JSON.stringify(payload),
        });
      }

      setActiveQuizForQuestion(null);
      setEditingQuestion(null);
      loadData();
    } catch (err: any) {
      alert(`Lỗi lưu câu hỏi: ${err.message}`);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm("Xóa câu hỏi này?")) {
      await api.deleteQuizQuestion(id);
      loadData();
    }
  };

  // ─── Batch Import Logic for Quizzes & Questions ───────────────────────────
  interface ParsedImportQuestion {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    points: number;
    isValid: boolean;
  }

  const parseQuizImportData = (raw: string) => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const questions: ParsedImportQuestion[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes("câu hỏi") || line.toLowerCase().includes("prompt"))) {
        continue;
      }

      const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const parts = line.split(delim).map((p) => p.trim());

      if (parts.length >= 5) {
        const prompt = parts[0];
        const optA = parts[1] || "";
        const optB = parts[2] || "";
        const optC = parts[3] || "";
        const optD = parts[4] || "";
        const correctRaw = (parts[5] || "A").toUpperCase().trim();
        const explanation = parts[6] || "";
        const pts = Number(parts[7]) || 2;

        let correctIdx = 0;
        if (correctRaw === "B" || correctRaw === "1") correctIdx = 1;
        else if (correctRaw === "C" || correctRaw === "2") correctIdx = 2;
        else if (correctRaw === "D" || correctRaw === "3") correctIdx = 3;

        const options = [optA, optB, optC, optD].filter((o) => o.length > 0);

        questions.push({
          prompt,
          options,
          correctIndex: correctIdx,
          explanation,
          points: pts,
          isValid: Boolean(prompt && options.length >= 2),
        });
      }
    }

    setParsedImportQuestions(questions);
  };

  const handleQuizFileUploaded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setImportRawText(content);
        parseQuizImportData(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadQuizTemplate = () => {
    const csvContent =
      "Câu hỏi;Lựa chọn A;Lựa chọn B;Lựa chọn C;Lựa chọn D;Đáp án đúng (A/B/C/D);Giải thích chi tiết;Điểm\n" +
      "「先生」の読み方はどれですか。;せんせい;がくせい;いしゃ;かいしゃいん;A;「先生」là thầy cô giáo, phát âm là せんせい.;2\n" +
      "田中さん _____ どこに行きますか。;は;が;を;に;A;Trợ từ は (wa) dùng để đánh dấu chủ đề của câu hỏi.;2\n" +
      "きのう 友達と 映画を _____。;見ました;見ます;見ない;見よう;A;Thì quá khứ của 見る là 見ました.;2\n" +
      "机の _____ に 猫が います。;うえ;した;なか;まえ;A;Trên bàn là 机の 上 (うえ).;2\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "de_thi_mau_jlpt.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteQuizImport = async () => {
    const validQuestions = parsedImportQuestions.filter((q) => q.isValid);
    if (validQuestions.length === 0) {
      alert("Không có câu hỏi hợp lệ nào để import. Vui lòng kiểm tra lại định dạng.");
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: validQuestions.length });

    try {
      let targetQuizId = importTargetQuizId;

      if (targetQuizId === "new") {
        const title = importNewQuizTitle.trim() || `Đề Thi Thử JLPT ${importNewQuizLevel} (Import)`;
        const createdQuiz = await api.createQuiz({
          title,
          description: `Bộ đề thi thử JLPT ${importNewQuizLevel} import tự động từ bảng dữ liệu.`,
          quizType: 2,
          passPercentage: importNewQuizPass,
          timeLimitMinutes: importNewQuizDuration,
        });
        targetQuizId = createdQuiz.id;
      }

      let count = 0;
      for (let i = 0; i < validQuestions.length; i++) {
        const q = validQuestions[i];
        const payload = {
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        };

        await api.createQuizQuestion({
          quizId: targetQuizId,
          questionType: 0,
          prompt: q.prompt,
          points: q.points || 2,
          displayOrder: i + 1,
          payloadJson: JSON.stringify(payload),
        });

        count++;
        setImportProgress({ current: i + 1, total: validQuestions.length });
      }

      setShowImportModal(false);
      setImportRawText("");
      setParsedImportQuestions([]);
      setActiveSelectedQuizId(targetQuizId);
      alert(`Đã import thành công ${count} câu hỏi vào bộ đề!`);
      loadData();
    } catch (err: any) {
      alert(`Lỗi khi import đề thi: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const getQuestionTypeName = (type: number) => {
    const names = [
      "Trắc nghiệm (4 lựa chọn)",
      "Nhiều đáp án (Multiple Select)",
      "Điền từ vào chỗ trống",
      "Sắp xếp thứ tự / Kéo thả",
      "Ghép cặp (Matching)",
      "Đúng / Sai (True/False)",
      "Nghe hiểu (Listening)",
      "Tự luận ngắn (Free Response)",
    ];
    return names[type] || "Câu hỏi";
  };

  const getQuizTypeBadge = (type: number) => {
    switch (type) {
      case 2:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold text-[10px] uppercase tracking-wide border border-rose-500/20">
            Đề Thi Thử JLPT
          </span>
        );
      case 1:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] border border-indigo-500/20">
            Ôn Tập Tổng Hợp
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
            Quiz Bài Học
          </span>
        );
    }
  };

  const allLessons = courses.flatMap((c) =>
    c.sections.flatMap((s) =>
      s.lessons.map((l) => ({
        id: l.id,
        name: `${c.jlptLevel} → ${s.title} → ${l.title}`,
      }))
    )
  );

  // Filter quizzes
  const filteredQuizzes = quizzes.filter((q) => {
    if (selectedTypeFilter !== "all" && q.quizType !== selectedTypeFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = q.title.toLowerCase().includes(term);
      const matchDesc = q.description?.toLowerCase().includes(term);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const selectedQuizObject = quizzes.find((q) => q.id === activeSelectedQuizId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900/5 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 pt-20">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase">
                Assessment CMS
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-orange-500" />
                Quản Lý Bộ Đề JLPT & Quiz
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý danh sách các bộ đề thi, chọn đề để quản lý câu hỏi & đáp án, import bộ đề nhanh từ CSV/Excel.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/quiz/mock"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs"
            >
              <PlayCircle className="w-4 h-4 text-emerald-500" />
              Xem Trang Luyện Đề (Học Viên)
            </Link>

            <button
              onClick={() => {
                setImportTargetQuizId(activeSelectedQuizId || "new");
                setImportNewQuizTitle("");
                setImportRawText("");
                setParsedImportQuestions([]);
                setShowImportModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import Đề Thi (CSV/TXT/Excel)
            </button>

            <button
              onClick={handleOpenCreateQuiz}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Thêm Bộ Đề Mới
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedTypeFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedTypeFilter === "all"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Tất Cả ({quizzes.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter(2)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedTypeFilter === 2
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Đề Thi Thử JLPT ({quizzes.filter((q) => q.quizType === 2).length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter(0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedTypeFilter === 0
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Quiz Bài Học ({quizzes.filter((q) => q.quizType === 0).length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm đề thi..."
              className="w-full px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
        </div>

        {/* ════════════════════════════ MASTER QUIZ LIST ════════════════════════════ */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
            <span>Danh Sách Các Bộ Đề Thi ({filteredQuizzes.length})</span>
            <span className="text-[11px] font-medium text-slate-400 lowercase">
              (Bấm vào đề để mở chi tiết & chỉnh sửa câu hỏi)
            </span>
          </h2>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              Đang tải danh sách bộ đề...
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60">
              Không tìm thấy bộ đề nào phù hợp. Bấm &ldquo;Thêm Bộ Đề Mới&rdquo; hoặc &ldquo;Import Đề Thi&rdquo; để bắt đầu!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuizzes.map((quiz) => {
                const isSelected = activeSelectedQuizId === quiz.id;
                const questionCount = quiz.questions?.length || 0;

                return (
                  <div
                    key={quiz.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-md cursor-pointer ${
                      isSelected
                        ? "border-orange-500 bg-orange-50/20 dark:bg-orange-950/20 ring-2 ring-orange-500/40"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                    onClick={() => setActiveSelectedQuizId(isSelected ? null : quiz.id)}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {getQuizTypeBadge(quiz.quizType ?? 0)}
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-orange-500" />
                          {quiz.timeLimitMinutes || 105} phút
                        </span>
                      </div>

                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {quiz.description || "Chưa có mô tả hướng dẫn."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <span className="text-orange-600 dark:text-orange-400 font-extrabold">{questionCount}</span> câu • Đỗ:{" "}
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{quiz.passPercentage}%</span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveSelectedQuizId(isSelected ? null : quiz.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                            isSelected
                              ? "bg-orange-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isSelected ? "Thu Gọn ▲" : "Chi Tiết ▼"}
                        </button>

                        <button
                          onClick={() => handleOpenEditQuiz(quiz)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Sửa thông tin đề"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(quiz.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Xóa bộ đề"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════════════════════════ DETAIL QUESTION MANAGEMENT VIEW ════════════════════════════ */}
        {selectedQuizObject && (
          <div className="mt-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-orange-500/40 shadow-xl flex flex-col gap-5 animate-in fade-in duration-200">
            {/* Header of Selected Quiz */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black shadow-md shrink-0 mt-0.5">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getQuizTypeBadge(selectedQuizObject.quizType ?? 0)}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {selectedQuizObject.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedQuizObject.description || "Bộ đề thi."}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium mt-1">
                    <span>Thời gian: <strong className="text-slate-700 dark:text-slate-300">{selectedQuizObject.timeLimitMinutes || 105} phút</strong></span>
                    <span>•</span>
                    <span>Điểm đỗ: <strong className="text-emerald-600 dark:text-emerald-400">{selectedQuizObject.passPercentage}%</strong></span>
                    <span>•</span>
                    <span>Tổng số: <strong className="text-orange-600 dark:text-orange-400">{selectedQuizObject.questions?.length || 0} câu hỏi</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/quiz/mock?id=${selectedQuizObject.id}`}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors"
                >
                  <PlayCircle className="w-4 h-4" />
                  Làm thử
                </Link>
                <button
                  onClick={() => handleOpenAddQuestion(selectedQuizObject)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Thêm câu hỏi
                </button>
                <button
                  onClick={() => setActiveSelectedQuizId(null)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-bold"
                  title="Đóng chi tiết"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Questions List for Selected Quiz */}
            <div className="flex flex-col gap-3">
              {!selectedQuizObject.questions || selectedQuizObject.questions.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Đề này chưa có câu hỏi nào. Bấm &ldquo;+ Thêm câu hỏi&rdquo; hoặc &ldquo;Import Đề Thi&rdquo; để nạp câu hỏi!
                </div>
              ) : (
                selectedQuizObject.questions.map((q, idx) => {
                  let parsedPayload: QuizQuestionPayload = {};
                  try {
                    parsedPayload = JSON.parse(q.payloadJson || "{}") as QuizQuestionPayload;
                  } catch {}

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col gap-3 transition-colors hover:border-orange-500/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                                {getQuestionTypeName(q.questionType)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono font-semibold">
                                {q.points} điểm
                              </span>
                            </div>
                            <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                              {q.prompt}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditQuestion(selectedQuizObject, q)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Sửa câu hỏi & Cập nhật đáp án"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Xóa câu hỏi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Listening Audio Player if available */}
                      {(q.questionType === 6 || parsedPayload.audioUrl) && parsedPayload.audioUrl && (
                        <div className="pl-10">
                          <DriveAudioPlayer
                            src={parsedPayload.audioUrl}
                            title="Tệp âm thanh nghe hiểu câu hỏi này"
                          />
                        </div>
                      )}

                      {/* Options Preview with Highlighted Correct Answer */}
                      {parsedPayload.options && Array.isArray(parsedPayload.options) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-10">
                          {parsedPayload.options.map((opt: string, optIdx: number) => {
                            const isCorrect = optIdx === parsedPayload.correctIndex;
                            return (
                              <div
                                key={optIdx}
                                className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                                  isCorrect
                                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0 font-bold ${
                                    isCorrect
                                      ? "bg-emerald-500 text-white"
                                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="truncate">{opt}</span>
                                {isCorrect && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Fill-in-the-blank answer preview */}
                      {parsedPayload.acceptableAnswers && (
                        <div className="pl-10 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <span>✓ Đáp án chấp nhận:</span>
                          <span className="font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                            {parsedPayload.acceptableAnswers.join(" | ")}
                          </span>
                        </div>
                      )}

                      {/* Explanation preview */}
                      {parsedPayload.explanation && (
                        <div className="pl-10 text-xs text-slate-500 dark:text-slate-400 italic bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/10">
                          💡 <strong>Giải thích:</strong> {parsedPayload.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════ MODALS ══════════════════════════════════ */}

      {/* Batch Import Quiz / Questions Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-4xl w-full flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Import Đề Thi & Câu Hỏi Hàng Loạt (CSV / TXT / Excel)
                </h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Banner & Template Download */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 block mb-1">
                  Định dạng mẫu từng câu hỏi (phân cách bằng dấu chấm phẩy &ldquo;;&rdquo; hoặc Tab):
                </span>
                <code className="font-mono text-[11px] text-emerald-800 dark:text-emerald-200 bg-emerald-500/10 px-2 py-1 rounded">
                  Câu hỏi ; Lựa chọn A ; Lựa chọn B ; Lựa chọn C ; Lựa chọn D ; Đáp án đúng (A/B/C/D) ; Giải thích ; Điểm
                </code>
              </div>
              <button
                onClick={handleDownloadQuizTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Tải File Mẫu Đề Thi (.CSV)
              </button>
            </div>

            {/* Import Target Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Mục tiêu Import:
                </label>
                <select
                  value={importTargetQuizId}
                  onChange={(e) => setImportTargetQuizId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold"
                >
                  <option value="new">➕ Tạo Mới Một Bộ Đề Thi Từ File Này</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      Nạp thêm vào đề: {q.title} ({q.questions?.length || 0} câu hiện có)
                    </option>
                  ))}
                </select>
              </div>

              {importTargetQuizId === "new" && (
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Tên Đề Thi Mới:
                  </label>
                  <input
                    type="text"
                    value={importNewQuizTitle}
                    onChange={(e) => setImportNewQuizTitle(e.target.value)}
                    placeholder="VD: Đề Thi Thử JLPT N5 — Đề Số 02"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
              )}
            </div>

            {importTargetQuizId === "new" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Cấp Độ JLPT
                  </label>
                  <select
                    value={importNewQuizLevel}
                    onChange={(e) => setImportNewQuizLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="N5">JLPT N5</option>
                    <option value="N4">JLPT N4</option>
                    <option value="N3">JLPT N3</option>
                    <option value="N2">JLPT N2</option>
                    <option value="N1">JLPT N1</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Thời Gian Thi (phút)
                  </label>
                  <input
                    type="number"
                    value={importNewQuizDuration}
                    onChange={(e) => setImportNewQuizDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Điểm Đỗ (%)
                  </label>
                  <input
                    type="number"
                    value={importNewQuizPass}
                    onChange={(e) => setImportNewQuizPass(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Paste data input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Dán nội dung câu hỏi từ Excel / File TXT hoặc Chọn file tải lên:
                </label>
                <label className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer border border-slate-300 dark:border-slate-700">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn File .CSV / .TXT</span>
                  <input
                    type="file"
                    accept=".csv, .txt"
                    onChange={handleQuizFileUploaded}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                value={importRawText}
                onChange={(e) => {
                  setImportRawText(e.target.value);
                  parseQuizImportData(e.target.value);
                }}
                rows={6}
                placeholder={`「先生」の読み方はどれですか。;せんせい;がくせい;いしゃ;かいしゃいん;A;「先生」là thầy cô giáo.;2\n田中さん _____ どこに行きますか。;は;が;を;に;A;Trợ từ は đánh dấu chủ đề.;2`}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            {/* Questions Preview Table */}
            {parsedImportQuestions.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Xem trước kết quả phân tích: <strong>{parsedImportQuestions.filter((q) => q.isValid).length}</strong> câu hỏi hợp lệ / {parsedImportQuestions.length} dòng
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Câu Hỏi</th>
                        <th className="p-2">4 Đáp Án</th>
                        <th className="p-2">Đáp Án Đúng</th>
                        <th className="p-2">Giải Thích</th>
                        <th className="p-2">Điểm</th>
                        <th className="p-2">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedImportQuestions.map((q, idx) => (
                        <tr key={idx} className={q.isValid ? "" : "bg-rose-500/10 text-rose-600"}>
                          <td className="p-2 font-bold">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                            {q.prompt || "(Trống)"}
                          </td>
                          <td className="p-2 max-w-[200px] truncate">
                            {q.options?.join(" | ") || "(Chưa đủ)"}
                          </td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black">
                              {String.fromCharCode(65 + (q.correctIndex || 0))}
                            </span>
                          </td>
                          <td className="p-2 max-w-[150px] truncate text-slate-500">
                            {q.explanation || "-"}
                          </td>
                          <td className="p-2 font-mono font-bold">{q.points || 2}đ</td>
                          <td className="p-2">
                            {q.isValid ? (
                              <span className="text-emerald-600 font-bold">✓ Hợp lệ</span>
                            ) : (
                              <span className="text-rose-600 font-bold">✗ Lỗi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Progress Bar during Import */}
            {isImporting && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Đang nhập câu hỏi vào bộ đề thi...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{
                      width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteQuizImport}
                disabled={isImporting || parsedImportQuestions.filter((q) => q.isValid).length === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isImporting ? "Đang Import..." : `Xác Nhận Import ${parsedImportQuestions.filter((q) => q.isValid).length} Câu Hỏi`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Quiz Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-orange-500" />
                {editingQuiz ? "Chỉnh Sửa Bộ Đề" : "Thêm Bộ Đề Thi Mới"}
              </h3>
              <button
                onClick={() => setShowQuizModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Tiêu đề bộ đề / Tên đề thi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="e.g. Đề Thi Thử JLPT N5 — Đề Số 01"
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Phân loại bộ đề
              </label>
              <select
                value={quizType}
                onChange={(e) => setQuizType(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-medium"
              >
                <option value={2}>Đề Thi Thử Chuẩn JLPT (Practice Test N5 - N1)</option>
                <option value={0}>Bài Kiểm Tra Bài Học (Lesson Quiz)</option>
                <option value={1}>Đề Ôn Tập Tổng Hợp (Global Review)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Mô tả hướng dẫn làm bài
              </label>
              <textarea
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                rows={2}
                placeholder="Mô phỏng cấu trúc đề thi JLPT chuẩn: Chữ Hán - Từ Vựng, Ngữ Pháp, Đọc Hiểu, Nghe Hiểu..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Thời gian thi (phút)
                </label>
                <input
                  type="number"
                  value={timeLimitMinutes || ""}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  placeholder="105"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Điểm đạt (%)
                </label>
                <input
                  type="number"
                  value={passPercentage}
                  onChange={(e) => setPassPercentage(Number(e.target.value))}
                  placeholder="60"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Gắn với bài học trong khóa (Tùy chọn)
              </label>
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              >
                <option value="">-- Không gắn vào bài nào (Độc lập / Luyện Đề Chung) --</option>
                {allLessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowQuizModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveQuiz}
                disabled={!quizTitle.trim()}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {editingQuiz ? "Cập Nhật Bộ Đề" : "Tạo Bộ Đề"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Question Modal (with Answer Updates, Explanations, and Local Audio Upload) */}
      {activeQuizForQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-xl w-full flex flex-col gap-4 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {editingQuestion ? "Chỉnh Sửa Câu Hỏi & Cập Nhật Đáp Án" : "Thêm Câu Hỏi Mới"}
                </h3>
                <p className="text-xs text-orange-500 font-semibold truncate max-w-sm">
                  Bộ đề: {activeQuizForQuestion.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveQuizForQuestion(null);
                  setEditingQuestion(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Dạng câu hỏi
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-medium"
                >
                  <option value={0}>Trắc nghiệm 4 lựa chọn (Multiple Choice)</option>
                  <option value={2}>Điền từ vào chỗ trống (Fill in blank)</option>
                  <option value={6}>Nghe hiểu có Audio (Listening Comprehension)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Điểm số câu hỏi
                </label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Nội dung câu hỏi (Prompt) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={2}
                placeholder="e.g. 【文字・語彙】「先生」の読み方はどれですか。"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
            </div>

            {/* Listening audio URL & Local Upload */}
            {questionType === 6 && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-orange-500" />
                    Tệp Âm Thanh Nghe Hiểu (Dual-Mode: Local Upload / Drive Link)
                  </label>
                  <label className="flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] cursor-pointer shadow-xs transition-all">
                    <Upload className="w-3 h-3" />
                    <span>{isUploadingAudio ? "Đang tải lên..." : "Tải Tệp MP3 Lên"}</span>
                    <input
                      type="file"
                      ref={audioFileInputRef}
                      accept="audio/*,.mp3,.wav,.m4a"
                      onChange={handleLocalAudioUpload}
                      disabled={isUploadingAudio}
                      className="hidden"
                    />
                  </label>
                </div>

                <input
                  type="text"
                  value={listeningAudioUrl}
                  onChange={(e) => setListeningAudioUrl(e.target.value)}
                  placeholder="Dán link Google Drive hoặc URL tệp MP3 (hoặc bấm Tải Tệp MP3 ở trên)..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />

                {listeningAudioUrl && (
                  <div className="mt-1">
                    <DriveAudioPlayer
                      src={listeningAudioUrl}
                      title="Xem trước âm thanh câu hỏi"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Multiple Choice Answers Configuration */}
            {(questionType === 0 || questionType === 6) && (
              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cấu hình 4 đáp án (Tích chọn radio tròn để chọn Đáp án ĐÚNG)
                  </label>
                </div>

                {mcOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                      mcCorrectIndex === idx
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="mcCorrectIndex"
                        checked={mcCorrectIndex === idx}
                        onChange={() => setMcCorrectIndex(idx)}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-black text-xs text-slate-700 dark:text-slate-300">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                    </label>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...mcOptions];
                        copy[idx] = e.target.value;
                        setMcOptions(copy);
                      }}
                      placeholder={`Nhập đáp án ${String.fromCharCode(65 + idx)}...`}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                    {mcCorrectIndex === idx && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-bold text-[10px] uppercase shrink-0">
                        ĐÁP ÁN ĐÚNG
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fill-in-the-Blank answer configuration */}
            {questionType === 2 && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Các đáp án chấp nhận (Ngăn cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={fillBlankAnswer}
                  onChange={(e) => setFillBlankAnswer(e.target.value)}
                  placeholder="e.g. に, ni, と, to"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-400">
                  Học viên nhập trùng với bất kỳ từ nào trong danh sách trên sẽ được tính điểm trọn vẹn.
                </span>
              </div>
            )}

            {/* Explanation & Solution */}
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Lời giải thích chi tiết (Hiển thị sau khi nộp bài thi)
              </label>
              <textarea
                value={explanationText}
                onChange={(e) => setExplanationText(e.target.value)}
                rows={2}
                placeholder="e.g. 「先生」đọc là せんせい (sensei) có nghĩa là thầy cô giáo..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setActiveQuizForQuestion(null);
                  setEditingQuestion(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                {editingQuestion ? "Cập Nhật Câu Hỏi & Đáp Án" : "Lưu Câu Hỏi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
