"use client";

import React from "react";
import Link from "next/link";
import { X, Settings, Clock, Bell, EyeOff, Sparkles } from "lucide-react";
import { useUserSettings } from "@/lib/userSettings";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, setTrackVideoWatchTime, setShowResumePrompt } = useUserSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Cài Đặt Học Tập
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tùy chỉnh trải nghiệm theo dõi tiến độ & bài giảng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setting Items */}
        <div className="flex flex-col gap-4">
          {/* Toggle 1: Track Video Watch Time */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-orange-500/30 transition-all">
            <div className="flex items-start gap-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                settings.trackVideoWatchTime 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}>
                {settings.trackVideoWatchTime ? <Clock className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Theo dõi số phút đã xem video
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    settings.trackVideoWatchTime
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  }`}>
                    {settings.trackVideoWatchTime ? "Đang bật" : "Đã tắt"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Tự động ghi nhận số phút đã học và vị trí video vào hệ thống. Tắt tính năng này nếu bạn không muốn lưu thời lượng xem hoặc muốn xem tự do.
                </p>
              </div>
            </div>

            {/* Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={settings.trackVideoWatchTime}
              onClick={() => setTrackVideoWatchTime(!settings.trackVideoWatchTime)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/50 mt-1 ${
                settings.trackVideoWatchTime ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.trackVideoWatchTime ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 2: Show Resume Prompt */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-orange-500/30 transition-all">
            <div className="flex items-start gap-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                settings.showResumePrompt && settings.trackVideoWatchTime
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" 
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}>
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Thông báo tiếp tục xem (Resume)
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    settings.showResumePrompt && settings.trackVideoWatchTime
                      ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  }`}>
                    {settings.showResumePrompt && settings.trackVideoWatchTime ? "Đang bật" : "Đã tắt"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Hiển thị hộp thoại và thông báo vị trí video đã xem gần nhất khi mở lại bài học để dễ dàng tiếp tục.
                </p>
              </div>
            </div>

            {/* Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={settings.showResumePrompt}
              disabled={!settings.trackVideoWatchTime}
              onClick={() => setShowResumePrompt(!settings.showResumePrompt)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/50 mt-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                settings.showResumePrompt && settings.trackVideoWatchTime ? "bg-orange-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.showResumePrompt && settings.trackVideoWatchTime ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Section 3: System & AI Settings Link */}
          <Link
            href="/admin/settings"
            onClick={onClose}
            className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-orange-950/20 border border-orange-500/30 hover:border-orange-500/60 transition-all group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    Cài Đặt Hệ Thống & AI Provider
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white uppercase">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Quản lý API Key Gemini / OpenAI, chọn mô hình (3.1, 3.5, 3.6) & Google Drive Sync
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-orange-200 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 shadow-xs group-hover:translate-x-0.5 transition-transform shrink-0">
              <Settings className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 transition-all active:scale-95"
          >
            Hoàn Tất
          </button>
        </div>
      </div>
    </div>
  );
};