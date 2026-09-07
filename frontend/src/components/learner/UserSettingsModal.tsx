"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  X, Settings, Clock, Bell, EyeOff, Sparkles, Moon, Sun,
  Languages, Server, Zap, CheckCircle2, ShieldCheck
} from "lucide-react";
import { useUserSettings } from "@/lib/userSettings";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { api, isBackendConnected } from "@/lib/api";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, setTrackVideoWatchTime, setShowResumePrompt } = useUserSettings();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const checkStatus = async () => {
        try {
          await api.getAuthStatus();
          setConnected(isBackendConnected);
        } catch {
          setConnected(false);
        }
      };
      checkStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#f8f9ff] dark:bg-[#0b1c30] rounded-3xl p-6 max-w-xl w-full border-2 border-[#d3e4fe] dark:border-slate-800 shadow-2xl flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#d3e4fe] dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[#006c49] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0b1c30] dark:text-white flex items-center gap-2">
                Cài Đặt Hệ Thống & Trải Nghiệm
              </h2>
              <p className="text-xs text-[#3c4a42] dark:text-slate-400 font-medium">
                Tùy chỉnh giao diện, học tập và trạng thái kết nối
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 border border-[#d3e4fe] dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Setting Groups */}
        <div className="flex flex-col gap-4">
          {/* Group 1: Giao diện & Ngôn ngữ */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#d3e4fe] dark:border-slate-800 flex flex-col gap-3 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#006c49] dark:text-emerald-400">
              Giao Diện & Ngôn Ngữ
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Theme switch */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700 hover:border-emerald-500/50 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                    {theme === "dark" ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#0b1c30] dark:text-white block">Giao diện</span>
                    <span className="text-[11px] text-slate-500 capitalize">{theme === "dark" ? "Chế độ Tối" : "Chế độ Sáng"}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-[#0b1c30] dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-600">
                  {theme === "dark" ? "Dark" : "Light"}
                </span>
              </button>

              {/* Language switch */}
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "vi" : "en")}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700 hover:border-emerald-500/50 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-[#006c49] dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Languages className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#0b1c30] dark:text-white block">Ngôn ngữ</span>
                    <span className="text-[11px] text-slate-500">{lang === "vi" ? "Tiếng Việt" : "English"}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#006c49] dark:text-emerald-400 uppercase">
                  {lang}
                </span>
              </button>
            </div>
          </div>

          {/* Group 2: Cài Đặt Bài Giảng & Video */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#d3e4fe] dark:border-slate-800 flex flex-col gap-3 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#006c49] dark:text-emerald-400">
              Trải Nghiệm Học & Xem Video
            </span>

            {/* Toggle 1: Track Video Watch Time */}
            <div className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  settings.trackVideoWatchTime 
                    ? "bg-emerald-500/10 text-[#006c49] dark:text-emerald-400" 
                    : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                }`}>
                  {settings.trackVideoWatchTime ? <Clock className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#0b1c30] dark:text-white">
                      Theo dõi số phút đã xem video
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.2 rounded-full uppercase ${
                      settings.trackVideoWatchTime
                        ? "bg-emerald-500/10 text-[#006c49] dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                    }`}>
                      {settings.trackVideoWatchTime ? "Bật" : "Tắt"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3c4a42] dark:text-slate-400 mt-0.5 leading-tight">
                    Ghi nhận thời lượng xem và vị trí video vào lịch sử học.
                  </p>
                </div>
              </div>

              {/* Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.trackVideoWatchTime}
                onClick={() => setTrackVideoWatchTime(!settings.trackVideoWatchTime)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-0.5 ${
                  settings.trackVideoWatchTime ? "bg-[#006c49]" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.trackVideoWatchTime ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Show Resume Prompt */}
            <div className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  settings.showResumePrompt && settings.trackVideoWatchTime
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                    : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                }`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#0b1c30] dark:text-white">
                      Thông báo tiếp tục xem (Resume)
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.2 rounded-full uppercase ${
                      settings.showResumePrompt && settings.trackVideoWatchTime
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                    }`}>
                      {settings.showResumePrompt && settings.trackVideoWatchTime ? "Bật" : "Tắt"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3c4a42] dark:text-slate-400 mt-0.5 leading-tight">
                    Hỏi tiếp tục xem từ đoạn đã dừng khi mở lại video bài học.
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
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-0.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  settings.showResumePrompt && settings.trackVideoWatchTime ? "bg-[#006c49]" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.showResumePrompt && settings.trackVideoWatchTime ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Group 3: Trạng Thái Kết Nối Máy Chủ */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#d3e4fe] dark:border-slate-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                connected ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
              }`}>
                {connected ? <Server className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs font-black text-[#0b1c30] dark:text-white block">Trạng thái API Backend</span>
                <span className="text-[11px] text-slate-500">
                  {connected ? "Máy chủ .NET đang hoạt động tại localhost:5222" : "Chế độ Demo / Offline"}
                </span>
              </div>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${
              connected
                ? "bg-emerald-500/10 border-emerald-500/30 text-[#006c49] dark:text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
            }`}>
              {connected ? "API Live" : "Demo"}
            </span>
          </div>

          {/* Group 4: System & AI Settings Link */}
          <Link
            href="/admin/settings"
            onClick={onClose}
            className="flex items-center justify-between p-4 rounded-2xl bg-[#eff4ff] dark:bg-slate-900 border-2 border-[#d3e4fe] dark:border-slate-800 hover:border-emerald-500/60 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-[#006c49] dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#0b1c30] dark:text-white group-hover:text-[#006c49] dark:group-hover:text-emerald-400 transition-colors">
                    Cài Đặt Hệ Thống & AI Provider (Admin)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Quản lý API Key Gemini, chọn Model AI (3.1, 3.5, 3.6) & Google Drive Sync
                </p>
              </div>
            </div>
            <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-[#006c49] dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 rounded-full bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs shadow-[0_4px_0_#00422b] hover:shadow-[0_2px_0_#00422b] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none transition-all"
          >
            Hoàn Tất
          </button>
        </div>
      </div>
    </div>
  );
};