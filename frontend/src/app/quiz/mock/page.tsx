"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { api, Quiz, ReportCardData, QuestionResultItem, QuizQuestionPayload } from "@/lib/api";
import { DriveAudioPlayer } from "@/components/common/DriveAudioPlayer";
import Link from "next/link";
import {
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Award,
  AlertTriangle,
  Loader2,
  HelpCircle,
  ArrowLeft,
  Maximize2,
  BookOpen,
  Volume2,
  Sparkles,
  RotateCcw,
  Check,
  Filter,
  PlayCircle,
  Trophy,
} from "lucide-react";

function JlptMockTestContent() {
  const searchParams = useSearchParams();
  const requestedQuizId = searchParams.get("id");

  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state for catalog
  const [levelFilter, setLevelFilter] = useState<string>("all");

  // Exam phase: "catalog" | "intro" | "test" | "result"
  const [phase, setPhase] = useState<"catalog" | "intro" | "test" | "result">("catalog");

  // Exam state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(105 * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load quizzes
  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        setLoading(true);
        const data = await api.getQuizzes();
        const practiceTests = data.filter((q) => q.quizType === 2 || (q.questions && q.questions.length > 0));
        setAllQuizzes(data);

        if (requestedQuizId) {
          const match = data.find((q) => q.id === requestedQuizId);
          if (match) {
            setSelectedQuiz(match);
            setTimeLeft((match.timeLimitMinutes || 105) * 60);
            setPhase("intro");
          }
        }
      } catch (err) {
        console.error("Failed to load quizzes", err);
      } finally {
        setLoading(false);
      }
    };
    loadQuizzes();
  }, [requestedQuizId]);

  // Timer logic
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (phase === "test") startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTimer]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const isTimeWarning = timeLeft < 300; // < 5 minutes

  const handleSelectChoice = (qId: string, idx: number) =>
    setUserAnswers((prev) => ({ ...prev, [qId]: JSON.stringify(idx) }));

  const handleTextAnswer = (qId: string, text: string) =>
    setUserAnswers((prev) => ({ ...prev, [qId]: JSON.stringify(text) }));

  const handleStartExam = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setTimeLeft((quiz.timeLimitMinutes || 105) * 60);
    setUserAnswers({});
    setCurrentQIndex(0);
    setReportCard(null);
    setPhase("test");
  };

  const handleSubmit = useCallback(
    async (isTimeout = false) => {
      if (!selectedQuiz) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setSubmitting(true);

      let earned = 0;
      const questions = selectedQuiz.questions || [];
      const max = questions.reduce((s, q) => s + (q.points || 1), 0);

      const results: QuestionResultItem[] = questions.map((q) => {
        let isCorrect = false;
        let explanation = "";
        let parsedPayload: QuizQuestionPayload = {};
        try {
          parsedPayload = JSON.parse(q.payloadJson || "{}") as QuizQuestionPayload;
          explanation = parsedPayload.explanation || "";
          const uAns = userAnswers[q.id];

          if (q.questionType === 0 || q.questionType === 6) {
            // Multiple choice / Listening
            if (parsedPayload.correctIndex !== undefined) {
              isCorrect = uAns === JSON.stringify(parsedPayload.correctIndex);
            }
          } else if (q.questionType === 2 && parsedPayload.acceptableAnswers) {
            // Fill in the blank
            const raw = uAns ? (JSON.parse(uAns) as string).toString().trim().toLowerCase() : "";
            isCorrect = parsedPayload.acceptableAnswers
              .map((a: string) => a.toLowerCase().trim())
              .includes(raw);
          }
        } catch {}

        const qPoint = q.points || 1;
        if (isCorrect) earned += qPoint;

        return {
          questionId: q.id,
          prompt: q.prompt,
          questionType: q.questionType,
          payload: parsedPayload,
          userAnswer: userAnswers[q.id],
          isCorrect,
          pointsEarned: isCorrect ? qPoint : 0,
          maxPoints: qPoint,
          explanation,
        };
      });

      const percentage = max > 0 ? Math.round((earned / max) * 100) : 0;
      const passScore = selectedQuiz.passPercentage ?? 60;

      setReportCard({
        score: earned,
        maxScore: max,
        percentage,
        isPassed: percentage >= passScore,
        passPercentage: passScore,
        questionResults: results,
        isTimeout,
      });

      setPhase("result");
      setSubmitting(false);
    },
    [selectedQuiz, userAnswers]
  );

  // Filter quizzes in catalog
  const filteredCatalog = allQuizzes.filter((q) => {
    if (levelFilter === "all") return true;
    return q.title.toLowerCase().includes(levelFilter.toLowerCase());
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] dark:bg-[#090d16] text-[#0b1c30] dark:text-slate-100 font-sans">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 pt-20">
        {/* ═══════════════════════ PHASE: CATALOG ═══════════════════════ */}
        {phase === "catalog" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Bento Hero Bar */}
            <div className="bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-[#d3e4fe] dark:border-slate-800">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shadow-xs shrink-0 border border-amber-500/20">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0b1c30] dark:text-white">
                      Trung Tâm Luyện Đề JLPT
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold border border-amber-200 dark:border-amber-800">
                      N5 — N1
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl font-medium leading-relaxed">
                    Thi thử trực tuyến với đồng hồ bấm giờ chuẩn, đầy đủ Từ Vựng/Chữ Hán, Ngữ Pháp, Đọc Hiểu và Nghe Hiểu có đáp án & lời giải chi tiết.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Link
                  href="/admin/quizzes"
                  className="btn-tactile-secondary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span>Quản Lý Đề (CMS)</span>
                </Link>
              </div>
            </div>

            {/* Level Filter Tabs */}
            <div className="bento-card p-3.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {["all", "N5", "N4", "N3", "N2", "N1"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                      levelFilter === lvl
                        ? "bg-amber-500 text-white shadow-[0_2px_0_#b45309]"
                        : "bg-[#eff4ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#d3e4fe] dark:border-slate-700 hover:bg-[#dce9ff]"
                    }`}
                  >
                    {lvl === "all" ? "Tất Cả Cấp Độ" : lvl}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-400 font-bold">
                Tìm thấy <strong className="text-slate-700 dark:text-slate-200">{filteredCatalog.length}</strong> bộ đề luyện thi
              </span>
            </div>

            {/* Quiz Cards Grid */}
            {loading ? (
              <div className="bento-card p-16 flex items-center justify-center gap-3 text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                Đang tải danh mục đề thi...
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="bento-card p-12 text-center text-xs text-slate-400">
                Chưa có đề thi nào cho cấp độ này. Hãy quay lại CMS để thêm đề mới!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCatalog.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bento-card p-5 transition-all flex flex-col justify-between gap-4 group hover:border-amber-400"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-wide border border-amber-500/20">
                          {quiz.quizType === 2 ? "JLPT Mock Test" : "Practice Quiz"}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          {quiz.timeLimitMinutes || 105} phút
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base text-[#0b1c30] dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed font-medium">
                        {quiz.description || "Bộ đề thi thử trực tuyến kiểm tra kiến thức tổng hợp."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        Số câu: <strong className="text-amber-600 dark:text-amber-400">{quiz.questions?.length || 0} câu</strong> • Điểm đỗ:{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">{quiz.passPercentage}%</strong>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedQuiz(quiz);
                          setPhase("intro");
                        }}
                        className="btn-tactile-amber px-4 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Vào Thi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════ PHASE: INTRO ═══════════════════════ */}
        {phase === "intro" && selectedQuiz && (
          <div className="max-w-2xl mx-auto w-full bento-card p-6 sm:p-8 shadow-xl flex flex-col gap-6 animate-in fade-in duration-200 border-[#d3e4fe] dark:border-slate-800">
            <button
              onClick={() => setPhase("catalog")}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0b1c30] dark:hover:text-white font-bold w-fit cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại danh mục đề
            </button>

            <div className="text-center flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shadow-xs border border-amber-500/20">
                <Trophy className="w-7 h-7" />
              </div>
              <h2 className="font-black text-xl sm:text-2xl text-[#0b1c30] dark:text-white">
                {selectedQuiz.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-medium">
                {selectedQuiz.description}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/60 border border-[#d3e4fe] dark:border-slate-700 text-center">
              <div>
                <span className="block text-[10px] uppercase font-extrabold text-slate-400">Thời gian</span>
                <span className="font-black text-base text-amber-600 dark:text-amber-400">
                  {selectedQuiz.timeLimitMinutes || 105} phút
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-extrabold text-slate-400">Số câu hỏi</span>
                <span className="font-black text-base text-[#0b1c30] dark:text-white">
                  {selectedQuiz.questions?.length || 0} câu
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-extrabold text-slate-400">Điểm Đỗ</span>
                <span className="font-black text-base text-emerald-600 dark:text-emerald-400">
                  {selectedQuiz.passPercentage}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex flex-col gap-1.5 leading-relaxed font-medium">
              <span className="font-extrabold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Lưu ý phòng thi:
              </span>
              <span>1. Đồng hồ đếm ngược sẽ bắt đầu chạy ngay khi bạn bấm nút &ldquo;Bắt Đầu Làm Bài&rdquo;.</span>
              <span>2. Bạn có thể chuyển đổi qua lại giữa các câu hỏi bất kỳ lúc nào qua bảng số câu.</span>
              <span>3. Kết quả điểm số và đáp án giải thích chi tiết sẽ hiển thị ngay sau khi bạn nộp bài.</span>
            </div>

            <button
              onClick={() => handleStartExam(selectedQuiz)}
              className="btn-tactile-amber w-full py-3 text-sm font-black cursor-pointer text-center"
            >
              Bắt Đầu Làm Bài Thi Ngay
            </button>
          </div>
        )}

        {/* ═══════════════════════ PHASE: TEST (PHÒNG THI) ═══════════════════════ */}
        {phase === "test" && selectedQuiz && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Top Exam Header & Timer */}
            <div className="bento-card p-4 flex items-center justify-between gap-4 sticky top-20 z-30 border-[#d3e4fe] dark:border-slate-800 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => {
                    if (confirm("Bạn có chắc muốn thoát phòng thi? Tiến trình bài thi sẽ không được lưu.")) {
                      setPhase("catalog");
                    }
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h2 className="font-black text-sm text-[#0b1c30] dark:text-white truncate">
                    {selectedQuiz.title}
                  </h2>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Đã làm {Object.keys(userAnswers).length} / {selectedQuiz.questions?.length || 0} câu
                  </span>
                </div>
              </div>

              {/* Timer Badge */}
              <div
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-black text-xs sm:text-sm shadow-xs ${
                  isTimeWarning
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeLeft)}</span>
              </div>

              <button
                onClick={() => {
                  const unanswered = (selectedQuiz.questions?.length || 0) - Object.keys(userAnswers).length;
                  if (
                    unanswered > 0 &&
                    !confirm(`Bạn vẫn còn ${unanswered} câu chưa làm. Bạn có chắc chắn muốn nộp bài?`)
                  ) {
                    return;
                  }
                  handleSubmit();
                }}
                disabled={submitting}
                className="btn-tactile-emerald px-4 sm:px-5 py-2 text-xs font-black cursor-pointer shrink-0"
              >
                {submitting ? "Đang Chấm..." : "Nộp Bài Thi"}
              </button>
            </div>

            {/* Question Workspace Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Question Content Area — 8/12 */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                {selectedQuiz.questions && selectedQuiz.questions[currentQIndex] ? (
                  (() => {
                    const q = selectedQuiz.questions[currentQIndex];
                    let payload: QuizQuestionPayload = {};
                    try {
                      payload = JSON.parse(q.payloadJson || "{}") as QuizQuestionPayload;
                    } catch {}

                    return (
                      <div className="bento-card p-6 flex flex-col gap-5 border-[#d3e4fe] dark:border-slate-800">
                        {/* Question Prompt */}
                        <div className="flex items-start gap-3">
                          <span className="w-8 h-8 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {currentQIndex + 1}
                          </span>
                          <div className="flex-1">
                            <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                              Câu {currentQIndex + 1} / {selectedQuiz.questions.length} • {q.points || 1} Điểm
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-[#0b1c30] dark:text-white mt-1 leading-relaxed">
                              {q.prompt}
                            </h3>
                          </div>
                        </div>

                        {/* Listening Comprehension Audio Player */}
                        {(q.questionType === 6 || payload.audioUrl) && payload.audioUrl && (
                          <div className="w-full">
                            <DriveAudioPlayer src={payload.audioUrl} title="Tệp Âm Thanh Nghe Hiểu (Choukai)" />
                          </div>
                        )}

                        {/* Multiple Choice Options */}
                        {(q.questionType === 0 || q.questionType === 6) && payload.options && (
                          <div className="flex flex-col gap-2.5 pt-2">
                            {payload.options.map((opt: string, optIdx: number) => {
                              const isSelected = userAnswers[q.id] === JSON.stringify(optIdx);
                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleSelectChoice(q.id, optIdx)}
                                  className={`w-full p-4 rounded-2xl border text-left font-semibold text-xs sm:text-sm flex items-center gap-3.5 transition-all cursor-pointer ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold shadow-xs ring-2 ring-amber-500/30"
                                      : "border-[#d3e4fe] dark:border-slate-800 bg-[#eff4ff]/60 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 hover:bg-[#dce9ff]"
                                  }`}
                                >
                                  <span
                                    className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                  {isSelected && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Fill in the blank input */}
                        {q.questionType === 2 && (
                          <div className="flex flex-col gap-2 pt-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              Nhập câu trả lời của bạn:
                            </label>
                            <input
                              type="text"
                              value={
                                userAnswers[q.id] ? JSON.parse(userAnswers[q.id]) : ""
                              }
                              onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                              placeholder="Nhập đáp án..."
                              className="w-full px-4 py-3 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-sm text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:outline-none font-medium"
                            />
                          </div>
                        )}

                        {/* Prev / Next Navigation Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                            disabled={currentQIndex === 0}
                            className="btn-tactile-secondary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <ChevronLeft className="w-4 h-4" /> Câu Trước
                          </button>

                          <button
                            onClick={() =>
                              setCurrentQIndex((prev) =>
                                Math.min((selectedQuiz.questions?.length || 1) - 1, prev + 1)
                              )
                            }
                            disabled={currentQIndex === (selectedQuiz.questions?.length || 1) - 1}
                            className="btn-tactile-amber px-4 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            Câu Tiếp Theo <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : null}
              </div>

              {/* Question Palette Sidebar — 4/12 */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="bento-card p-5 flex flex-col gap-4 sticky top-36 border-[#d3e4fe] dark:border-slate-800">
                  <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Bảng Câu Hỏi ({selectedQuiz.questions?.length || 0})
                  </h4>

                  <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {selectedQuiz.questions?.map((q, idx) => {
                      const isAnswered = !!userAnswers[q.id];
                      const isCurrent = currentQIndex === idx;

                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentQIndex(idx)}
                          className={`h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                            isCurrent
                              ? "ring-2 ring-amber-500 bg-amber-500 text-white shadow-xs"
                              : isAnswered
                              ? "bg-emerald-500 text-white shadow-2xs"
                              : "bg-[#eff4ff] dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#dce9ff]"
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 text-[11px] font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-400">Đã trả lời ({Object.keys(userAnswers).length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-400">
                        Chưa trả lời ({(selectedQuiz.questions?.length || 0) - Object.keys(userAnswers).length})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ PHASE: RESULT & REVIEW ═══════════════════════ */}
        {phase === "result" && reportCard && selectedQuiz && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Score Summary Card */}
            <div className="bento-card p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border-[#d3e4fe] dark:border-slate-800">
              <div className="flex items-center gap-5">
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0 ${
                    reportCard.isPassed
                      ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20"
                      : "bg-gradient-to-tr from-rose-600 to-amber-600 shadow-rose-500/20"
                  }`}
                >
                  {reportCard.percentage}%
                </div>

                <div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      reportCard.isPassed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {reportCard.isPassed ? "🎉 KẾT QUẢ: ĐẠT (PASS)" : "⚠️ KẾT QUẢ: CHƯA ĐẠT (FAIL)"}
                  </span>
                  <h2 className="font-black text-xl text-[#0b1c30] dark:text-white mt-1.5">
                    {selectedQuiz.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    Điểm số: <strong className="text-emerald-600 dark:text-emerald-400">{reportCard.score}</strong> / {reportCard.maxScore} điểm • Chuẩn đỗ:{" "}
                    <strong>{reportCard.passPercentage}%</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => handleStartExam(selectedQuiz)}
                  className="btn-tactile-amber px-4 py-2.5 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Làm Lại Đề Này
                </button>
                <button
                  onClick={() => setPhase("catalog")}
                  className="btn-tactile-secondary px-4 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Chọn Đề Khác
                </button>
              </div>
            </div>

            {/* Detailed Question Review List */}
            <div className="flex flex-col gap-4">
              <h3 className="font-black text-base text-[#0b1c30] dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Xem Lại Đáp Án & Lời Giải Thích Chi Tiết ({reportCard.questionResults?.length || 0} câu)
              </h3>

              {reportCard.questionResults?.map((res: QuestionResultItem, idx: number) => {
                const payload = res.payload || {};
                let userChoiceIdx: number | null = null;
                try {
                  userChoiceIdx = res.userAnswer ? (JSON.parse(res.userAnswer) as number) : null;
                } catch {}

                return (
                  <div
                    key={res.questionId}
                    className={`bento-card p-5 transition-all ${
                      res.isCorrect
                        ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/30"
                        : "bg-rose-50/30 dark:bg-rose-950/10 border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span
                          className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                            res.isCorrect
                              ? "bg-emerald-500 text-white"
                              : "bg-rose-500 text-white"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                res.isCorrect
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {res.isCorrect ? "✓ Chính xác" : "✗ Sai"} (+{res.pointsEarned}/{res.maxPoints}đ)
                            </span>
                          </div>
                          <h4 className="font-black text-sm text-[#0b1c30] dark:text-white leading-relaxed">
                            {res.prompt}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* Options Review for Multiple Choice */}
                    {payload.options && Array.isArray(payload.options) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pl-10">
                        {payload.options.map((opt: string, optIdx: number) => {
                          const isCorrectAnswer = optIdx === payload.correctIndex;
                          const isUserChoice = userChoiceIdx === optIdx;

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
                                isCorrectAnswer
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold"
                                  : isUserChoice && !isCorrectAnswer
                                  ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold line-through"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 opacity-70"
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                                  isCorrectAnswer
                                    ? "bg-emerald-500 text-white"
                                    : isUserChoice
                                    ? "bg-rose-500 text-white"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrectAnswer && (
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                                  Đáp án đúng
                                </span>
                              )}
                              {isUserChoice && !isCorrectAnswer && (
                                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase">
                                  Bạn đã chọn
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Fill in the blank answer review */}
                    {res.questionType === 2 && (
                      <div className="pl-10 mt-2 flex flex-col gap-1 text-xs">
                        <span className="text-slate-500">
                          Câu trả lời của bạn:{" "}
                          <strong className={res.isCorrect ? "text-emerald-600" : "text-rose-600"}>
                            {res.userAnswer ? JSON.parse(res.userAnswer) : "(Chưa trả lời)"}
                          </strong>
                        </span>
                        {payload.acceptableAnswers && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Đáp án chuẩn: {payload.acceptableAnswers.join(" | ")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {res.explanation && (
                      <div className="mt-3 ml-10 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-[#d3e4fe] dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-2xs font-medium">
                        💡 <strong>Lời giải thích chi tiết:</strong> {res.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function JlptMockTestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900/5 dark:bg-slate-950 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      }
    >
      <JlptMockTestContent />
    </Suspense>
  );
}
