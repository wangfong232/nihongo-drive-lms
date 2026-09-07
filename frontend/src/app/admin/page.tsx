"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  BookOpen, Layers, HelpCircle, Sparkles, Server, Zap,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink,
  TrendingUp, Users, Database, Target
} from "lucide-react";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalLessons: 0,
    totalVocab: 0,
    totalQuizzes: 0,
  });
  const [authStatus, setAuthStatus] = useState<{ isAuthenticated: boolean; expiresAtUtc?: string; scope?: string } | null>(null);
  const [srsStats, setSrsStats] = useState({ dueToday: 0, newToday: 0, reviewedToday: 0, streak: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [courses, vocab, quizzes, auth, srs] = await Promise.all([
          api.getCourses(),
          api.getVocabulary(),
          api.getQuizzes(),
          api.getAuthStatus(),
          api.getSrsStats(),
        ]);

        const totalLessons = courses.reduce(
          (s, c) => s + c.sections.reduce((ss, sec) => ss + sec.lessons.length, 0),
          0
        );

        setStats({
          totalCourses: courses.length,
          totalLessons,
          totalVocab: vocab.length,
          totalQuizzes: quizzes.length,
        });
        setAuthStatus(auth);
        setSrsStats(srs as any);
      } catch (err) {
        console.error("Admin dashboard load error", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const quickLinks = [
    {
      href: "/admin/builder",
      icon: Layers,
      label: "Course Builder & CMS",
      desc: "Tạo và quản lý khóa học, chương, bài học và tài nguyên Drive",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      href: "/admin/vocabulary",
      icon: BookOpen,
      label: "Vocabulary CMS & SRS",
      desc: "Thêm, sửa, xóa từ vựng và cấu hình bộ thẻ ôn tập SM-2",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    {
      href: "/admin/quizzes",
      icon: HelpCircle,
      label: "Quiz & Đề Thi CMS",
      desc: "Tạo đề thi JLPT, quiz bài học với nhiều dạng câu hỏi",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      href: "/quiz/mock",
      icon: Target,
      label: "JLPT Mock Test",
      desc: "Luyện đề thi thử JLPT với đồng hồ đếm ngược và chấm điểm",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] dark:bg-[#090d16] text-[#0b1c30] dark:text-slate-100 font-sans">
      <Header srsStats={srsStats} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 pt-20">

        {/* Title Bento Card */}
        <div className="bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#f97316] block mb-1">
              HỆ THỐNG QUẢN TRỊ NỘI DUNG & ĐỒNG BỘ
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0b1c30] dark:text-white flex items-center gap-2.5">
              <Server className="w-6 h-6 text-indigo-600" />
              Admin Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Quản lý tài nguyên Google Drive, đồng bộ bài học, kho từ vựng và đề thi JLPT.
            </p>
          </div>
          <Link
            href="/"
            className="btn-tactile-emerald px-5 py-2.5 text-xs font-black flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Sang Learner Portal</span>
          </Link>
        </div>

        {/* Stats Grid (Playful Bento) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          {[
            { label: "Khóa Học", value: stats.totalCourses, icon: Layers, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200/80 dark:border-indigo-800" },
            { label: "Bài Học", value: stats.totalLessons, icon: BookOpen, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200/80 dark:border-amber-800" },
            { label: "Từ Vựng", value: stats.totalVocab, icon: Sparkles, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200/80 dark:border-emerald-800" },
            { label: "Bộ Quiz", value: stats.totalQuizzes, icon: HelpCircle, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200/80 dark:border-purple-800" },
          ].map((s) => (
            <div
              key={s.label}
              className="bento-card p-6 flex flex-col gap-3 hover:shadow-md transition-all group"
            >
              <div className={`w-11 h-11 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center ${s.color} shadow-xs group-hover:scale-105 transition-transform`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                {loading ? (
                  <div className="h-8 w-16 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                ) : (
                  <p className="text-3xl font-black text-[#0b1c30] dark:text-white tracking-tight">{s.value}</p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Google OAuth Status Card */}
        <div className="bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              authStatus?.isAuthenticated
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
            }`}>
              {authStatus?.isAuthenticated
                ? <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                : <AlertCircle className="w-6 h-6 text-rose-500" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">XÁC THỰC GOOGLE CLOUD</span>
              <h3 className="font-extrabold text-base text-[#0b1c30] dark:text-white">Google Drive OAuth 2.0</h3>
              {authStatus?.isAuthenticated ? (
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đã liên kết tài khoản Drive thành công
                  </p>
                  {authStatus.expiresAtUtc && (
                    <p className="text-[11px] text-slate-400">Hạn token: {new Date(authStatus.expiresAtUtc).toLocaleString("vi-VN")}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1">⚠️ Chưa xác thực — Cần kết nối Google Drive để đồng bộ</p>
              )}
            </div>
          </div>
          <a
            href="http://localhost:5222/api/auth/google/login"
            className={`px-5 py-2.5 rounded-full text-xs font-black flex items-center gap-2 shrink-0 cursor-pointer ${
              authStatus?.isAuthenticated
                ? "btn-tactile-secondary"
                : "btn-tactile-amber"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{authStatus?.isAuthenticated ? "Xác Thực Lại" : "Kết Nối Google Drive"}</span>
          </a>
        </div>

        {/* SRS Stats Row */}
        <div className="bento-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-[#0b1c30] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Hệ Thống Ôn Tập Thẻ Nhớ SRS (Spaced Repetition)
            </h3>
            <span className="text-[11px] text-slate-400 font-bold">Thuật toán SuperMemo SM-2</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {[
              { label: "Thẻ Cần Ôn", value: srsStats.dueToday, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50/70 dark:bg-rose-950/30", border: "border-rose-200/80 dark:border-rose-900" },
              { label: "Từ Mới", value: srsStats.newToday, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50/70 dark:bg-sky-950/30", border: "border-sky-200/80 dark:border-sky-900" },
              { label: "Đã Ôn Hôm Nay", value: srsStats.reviewedToday, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/70 dark:bg-emerald-950/30", border: "border-emerald-200/80 dark:border-emerald-900" },
              { label: "Streak Liên Tiếp", value: `${srsStats.streak} ngày`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/70 dark:bg-amber-950/30", border: "border-amber-200/80 dark:border-amber-900" },
            ].map((s) => (
              <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border ${s.border} text-center flex flex-col gap-1`}>
                <p className={`text-2xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links (Bento Cards with Plush Tactility) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bento-card p-6 hover:shadow-lg transition-all flex items-center gap-4 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-2xl ${link.bg} border ${link.border} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs`}>
                <link.icon className={`w-6 h-6 ${link.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-[#0b1c30] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{link.label}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 font-medium">{link.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>

        {/* DB Connection Bar */}
        <div className="bento-card p-4 text-xs text-slate-500 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-bold text-slate-700 dark:text-slate-300">PostgreSQL LMS:</span>
            <code className="text-[11px] font-mono bg-[#eff4ff] dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-[#d3e4fe] dark:border-slate-700">
              Host=localhost;Port=5433;Database=nihongo_lms
            </code>
          </div>
          <div>
            Swagger API:{" "}
            <a href="http://localhost:5222/swagger" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold">
              localhost:5222/swagger ↗
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
