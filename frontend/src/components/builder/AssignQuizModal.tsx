"use client";

import React, { useState, useEffect } from "react";
import { Lesson, Quiz, api } from "@/lib/api";
import { HelpCircle, Search, Check, X, Loader2, Sparkles, Plus, ExternalLink, Unlink } from "lucide-react";
import Link from "next/link";

interface AssignQuizModalProps {
  lesson: Lesson;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignQuizModal: React.FC<AssignQuizModalProps> = ({
  lesson,
  onClose,
  onSuccess,
}) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<number | "all">("all");

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const data = await api.getQuizzes();
      setQuizzes(data);
    } catch (err) {
      console.error("Failed to load quizzes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleAssign = async (quizId: string) => {
    try {
      setAssigningId(quizId);
      await api.assignQuizToLesson(quizId, lesson.id);
      await loadQuizzes();
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi khi gắn quiz: ${err.message}`);
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassign = async (quizId: string) => {
    try {
      setAssigningId(quizId);
      await api.assignQuizToLesson(quizId, null);
      await loadQuizzes();
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi khi gỡ quiz: ${err.message}`);
    } finally {
      setAssigningId(null);
    }
  };

  const filteredQuizzes = quizzes.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.description && q.description.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === "all" || q.quizType === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeName = (type: number) => {
    switch (type) {
      case 0:
        return "Lesson Quiz";
      case 1:
        return "Global Review";
      case 2:
        return "JLPT Mock Test";
      default:
        return "Quiz";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-2xl w-full flex flex-col gap-4 shadow-2xl max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Gắn Đề Thi / Quiz Vào Bài Học
              </h3>
              <p className="text-xs text-slate-400">
                Bài học: <span className="font-bold text-orange-600 dark:text-orange-400">{lesson.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên đề thi, từ khóa..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["all", 0, 2, 1] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  filterType === type
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {type === "all" ? "Tất Cả" : type === 0 ? "Lesson Quiz" : type === 2 ? "JLPT Test" : "Review"}
              </button>
            ))}
          </div>
        </div>

        {/* Quiz List */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] flex flex-col gap-2.5 pr-1 custom-scrollbar">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs">Đang tải danh sách bộ đề...</span>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-3">
              <p>Chưa tìm thấy bộ đề thi nào phù hợp.</p>
              <Link
                href="/admin/quizzes"
                target="_blank"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md"
              >
                <Plus className="w-3.5 h-3.5" /> Tạo Bộ Đề Thi Mới
              </Link>
            </div>
          ) : (
            filteredQuizzes.map((quiz) => {
              const isAssignedToThis = quiz.lessonId === lesson.id;
              const isAssignedToOther = quiz.lessonId && quiz.lessonId !== lesson.id;
              const isProcessing = assigningId === quiz.id;

              return (
                <div
                  key={quiz.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isAssignedToThis
                      ? "border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 ring-2 ring-amber-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isAssignedToThis
                          ? "bg-amber-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {quiz.questions?.length ?? 0}Q
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {quiz.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {getTypeName(quiz.quizType)}
                        </span>
                        {isAssignedToThis && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/30">
                            ✓ Đang gắn với bài này
                          </span>
                        )}
                        {isAssignedToOther && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-400 font-semibold text-[10px]">
                            Đã gắn với bài khác
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        {quiz.timeLimitMinutes && <span>⏱️ {quiz.timeLimitMinutes} phút</span>}
                        <span>🎯 Điểm đạt: {quiz.passPercentage}%</span>
                        {quiz.description && <span className="truncate max-w-[250px]">{quiz.description}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAssignedToThis ? (
                      <button
                        onClick={() => handleUnassign(quiz.id)}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold transition-all disabled:opacity-50 border border-rose-200 dark:border-rose-800"
                        title="Gỡ quiz khỏi bài học này"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                        <span>Gỡ Bỏ</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAssign(quiz.id)}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm shadow-amber-500/20"
                        title="Gắn quiz vào bài học này"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Gắn Vào Bài</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <Link
            href="/admin/quizzes"
            target="_blank"
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở trang Quản Lý Bộ Đề & Quiz</span>
          </Link>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
