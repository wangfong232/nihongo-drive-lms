"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { api, Quiz, QuizQuestion, QuizSubmissionResult, QuestionGradeResult } from "@/lib/api";
import {
  HelpCircle, CheckCircle2, XCircle, Award, X, ChevronRight, ChevronLeft,
  Loader2, Clock, AlertTriangle
} from "lucide-react";

interface QuizModalProps {
  quizId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export interface QuizModalReportCard extends QuizSubmissionResult {
  questionResults: (QuestionGradeResult & { prompt?: string })[];
  isTimeout?: boolean;
}

export const QuizModal: React.FC<QuizModalProps> = ({ quizId, onClose, onSuccess }) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reportCard, setReportCard] = useState<QuizModalReportCard | null>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load quiz using centralized api.ts
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const data = await api.getQuizById(quizId);
        setQuiz(data);
        if (data.timeLimitMinutes) {
          setTimeLeft(data.timeLimitMinutes * 60);
        }
      } catch {
        setQuiz(null);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || reportCard) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true); // Auto-submit on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [timeLeft !== null && !reportCard]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isTimeWarning = timeLeft !== null && timeLeft < 60;

  const handleSelectChoice = (questionId: string, choiceIndex: number) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: JSON.stringify(choiceIndex) }));
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: JSON.stringify(text) }));
  };

  const handleSubmit = useCallback(async (isTimeout = false) => {
    if (!quiz) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSubmitting(true);
    const answersPayload = Object.entries(userAnswers).map(([qId, ans]) => ({
      questionId: qId,
      answerJson: ans,
    }));

    // Try server-side grading first
    const serverResult = await api.submitQuizAttempt(quizId, answersPayload);
    if (serverResult) {
      setReportCard(serverResult);
      if ((serverResult as any).isPassed) onSuccess();
      setSubmitting(false);
      return;
    }

    // Local grading fallback
    let earned = 0;
    const max = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    const results = quiz.questions.map((q) => {
      let isCorrect = false;
      let explanation = "";
      try {
        const payload = JSON.parse(q.payloadJson);
        explanation = payload.explanation || "";
        const uAns = userAnswers[q.id];
        if (q.questionType === 0 && payload.correctIndex !== undefined) {
          isCorrect = uAns === JSON.stringify(payload.correctIndex);
        } else if (q.questionType === 2 && payload.acceptableAnswers) {
          const raw = uAns ? JSON.parse(uAns).toString().trim().toLowerCase() : "";
          isCorrect = payload.acceptableAnswers.map((a: string) => a.toLowerCase()).includes(raw);
        }
      } catch {}
      if (isCorrect) earned += q.points;
      return {
        questionId: q.id,
        prompt: q.prompt,
        isCorrect,
        pointsEarned: isCorrect ? q.points : 0,
        maxPoints: q.points,
        feedback: isCorrect ? "Trả lời chính xác! ✓" : "Chưa chính xác.",
        correctAnswerExplanation: explanation,
      };
    });

    const percentage = max > 0 ? Math.round((earned / max) * 100) : 0;
    const isPassed = percentage >= quiz.passPercentage;

    setReportCard({ quizId, score: earned, maxScore: max, percentage, isPassed, questionResults: results, isTimeout });
    if (isPassed) onSuccess();
    setSubmitting(false);
  }, [quiz, userAnswers, quizId, onSuccess]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl flex items-center gap-3 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
          Đang tải bài tập...
        </div>
      </div>
    );
  }

  if (!quiz) return null;
  const currentQ = quiz.questions[currentQIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bento-card max-w-2xl w-full flex flex-col min-h-[500px] max-h-[90vh] shadow-2xl border-[#d3e4fe] dark:border-slate-800 overflow-hidden">

        {/* ── Header ── */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#eff4ff]/60 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#0b1c30] dark:text-white line-clamp-1">{quiz.title}</h3>
              <span className="text-[10px] text-slate-400 font-mono font-bold">Điểm đạt: {quiz.passPercentage}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timer */}
            {timeLeft !== null && !reportCard && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono transition-colors ${
                isTimeWarning
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {formatTime(timeLeft)}
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col">
          {reportCard ? (
            /* ── Report Card ── */
            <div className="flex flex-col items-center text-center gap-4 py-2">
              {reportCard.isTimeout && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-bold w-full justify-center">
                  <AlertTriangle className="w-4 h-4" /> Đã hết giờ — Bài được chấm tự động
                </div>
              )}

              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black shadow-lg ${
                reportCard.isPassed ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" : "bg-rose-500/10 text-rose-600 border border-rose-500/30"
              }`}>
                {reportCard.isPassed ? <Award className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>

              <div>
                <h2 className="text-xl font-black text-[#0b1c30] dark:text-white">
                  {reportCard.isPassed ? "Xuất Sắc! Bạn Đã Vượt Qua! 🎉" : "Chưa Đạt — Thử Lại Nhé!"}
                </h2>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  Kết quả: <strong className="text-emerald-600 dark:text-emerald-400">{reportCard.score}</strong> / {reportCard.maxScore} điểm ({reportCard.percentage}%)
                </p>
                {/* Score ring */}
                <div className="flex items-center justify-center mt-2">
                  <div className={`text-3xl font-black ${
                    reportCard.percentage >= quiz.passPercentage ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    {reportCard.percentage}%
                  </div>
                </div>
              </div>

              {/* Question breakdown */}
              <div className="w-full flex flex-col gap-2 mt-2 text-left max-h-64 overflow-y-auto pr-1">
                {reportCard.questionResults.map((qr, idx: number) => (
                  <div key={idx} className={`p-3.5 rounded-2xl border text-xs ${
                    qr.isCorrect
                      ? "border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20"
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 line-clamp-2">{qr.prompt || `Câu hỏi ${idx + 1}`}</span>
                      <span className={`shrink-0 font-extrabold ${qr.isCorrect ? "text-emerald-600" : "text-rose-600"}`}>
                        {qr.isCorrect ? `+${qr.pointsEarned}đ` : "Sai"}
                      </span>
                    </div>
                    {qr.correctAnswerExplanation && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 italic font-medium mt-1">
                        💡 {qr.correctAnswerExplanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={onClose} className="btn-tactile-emerald px-6 py-2 text-xs font-black cursor-pointer">
                  Đóng
                </button>
              </div>
            </div>

          ) : currentQ ? (
            /* ── Question Runner ── */
            <div className="flex-1 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-4">
                {/* Progress */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono font-bold">
                    <span>Câu hỏi {currentQIndex + 1} / {quiz.questions.length}</span>
                    <span className="text-slate-500">{currentQ.points} điểm</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#eff4ff] dark:bg-slate-800 overflow-hidden border border-[#d3e4fe] dark:border-slate-700">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${((currentQIndex + 1) / quiz.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <h3 className="text-base font-extrabold text-[#0b1c30] dark:text-white leading-snug">{currentQ.prompt}</h3>

                {/* Answer options */}
                <div className="flex flex-col gap-2">
                  {(() => {
                    try {
                      const payload = JSON.parse(currentQ.payloadJson);
                      if (payload.options) {
                        return payload.options.map((opt: string, idx: number) => {
                          const isSelected = userAnswers[currentQ.id] === JSON.stringify(idx);
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectChoice(currentQ.id, idx)}
                              className={`p-3.5 rounded-2xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs ring-2 ring-emerald-500/30"
                                  : "border-[#d3e4fe] dark:border-slate-800 bg-[#eff4ff]/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-[#dce9ff]"
                              }`}
                            >
                              <span className="inline-flex items-center gap-2.5">
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                                  isSelected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 dark:border-slate-600 text-slate-400"
                                }`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                {opt}
                              </span>
                            </button>
                          );
                        });
                      }
                    } catch {}
                    // Text input fallback
                    return (
                      <input
                        type="text"
                        value={userAnswers[currentQ.id] ? JSON.parse(userAnswers[currentQ.id]) : ""}
                        onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                        placeholder="Nhập câu trả lời của bạn..."
                        className="w-full p-3 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs text-[#0b1c30] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setCurrentQIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentQIndex === 0}
                  className="btn-tactile-secondary px-4 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" /> Câu Trước
                </button>

                {currentQIndex + 1 === quiz.questions.length ? (
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="btn-tactile-emerald px-5 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Nộp Bài
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQIndex((prev) => Math.min(prev + 1, quiz.questions.length - 1))}
                    className="btn-tactile-emerald px-4 py-1.5 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    Câu Tiếp <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
