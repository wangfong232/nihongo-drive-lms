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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header srsStats={srsStats} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">

        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              Admin Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tổng quan hệ thống DriveLearn — quản lý nội dung, Google Drive OAuth và SRS.
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
          >
            <BookOpen className="w-4 h-4" />
            Chuyển sang Learner Portal
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Khóa Học", value: stats.totalCourses, icon: Layers, color: "text-indigo-500", bg: "bg-indigo-500/10" },
            { label: "Bài Học", value: stats.totalLessons, icon: BookOpen, color: "text-orange-500", bg: "bg-orange-500/10" },
            { label: "Từ Vựng", value: stats.totalVocab, icon: Sparkles, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Bộ Quiz", value: stats.totalQuizzes, icon: HelpCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          ].map((s) => (
            <div
              key={s.label}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2"
            >
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              {loading ? (
                <div className="h-7 w-12 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              ) : (
                <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
              )}
              <p className="text-xs text-slate-500 font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Google OAuth Status Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              authStatus?.isAuthenticated ? "bg-emerald-500/10" : "bg-rose-500/10"
            }`}>
              {authStatus?.isAuthenticated
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                : <AlertCircle className="w-5 h-5 text-rose-500" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Google Drive OAuth</h3>
              {authStatus?.isAuthenticated ? (
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓ Đã kết nối Google Drive</p>
                  {authStatus.expiresAtUtc && (
                    <p className="text-[11px] text-slate-400">Token hết hạn: {new Date(authStatus.expiresAtUtc).toLocaleString("vi-VN")}</p>
                  )}
                  {authStatus.scope && (
                    <p className="text-[11px] text-slate-400 truncate max-w-xs">Scope: {authStatus.scope}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-rose-500 font-semibold mt-1">⚠️ Chưa xác thực — Cần kết nối Google Drive để đồng bộ</p>
              )}
            </div>
          </div>
          <a
            href="http://localhost:5222/api/auth/google/login"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 ${
              authStatus?.isAuthenticated
                ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                : "bg-orange-600 hover:bg-orange-700 text-white border-orange-600 shadow-md shadow-orange-500/20"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {authStatus?.isAuthenticated ? "Xác Thực Lại" : "Kết Nối Google Drive"}
          </a>
        </div>

        {/* SRS Stats Row */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Hệ Thống Ôn Tập SRS Hôm Nay
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Thẻ Cần Ôn", value: srsStats.dueToday, color: "text-rose-500" },
              { label: "Từ Mới", value: srsStats.newToday, color: "text-blue-500" },
              { label: "Đã Ôn Hôm Nay", value: srsStats.reviewedToday, color: "text-emerald-500" },
              { label: "Streak (ngày)", value: srsStats.streak, color: "text-orange-500" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center">
                <p className={`text-xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-500/30 shadow-sm transition-all hover:shadow-md flex items-center gap-4"
            >
              <div className={`w-11 h-11 rounded-xl ${link.bg} border ${link.border} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                <link.icon className={`w-5 h-5 ${link.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{link.label}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{link.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-orange-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>

        {/* DB Connection Note */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-start gap-3">
          <Database className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300">PostgreSQL:</span>{" "}
            <code className="text-[11px] font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              Host=localhost;Port=5433;Database=nihongo_lms
            </code>
            <br />
            Backend API chạy tại{" "}
            <a href="http://localhost:5222/swagger" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline font-semibold">
              localhost:5222/swagger
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
