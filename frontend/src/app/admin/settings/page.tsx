"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import {
  KeyRound,
  ShieldCheck,
  Server,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Save,
  Cpu,
  Lock,
  Terminal,
  FileCode,
  Info,
  Check,
  ArrowRight,
  ChevronRight,
  Layers,
  HelpCircle,
} from "lucide-react";

interface AiSettingsState {
  isConfigured: boolean;
  source: "database" | "environment" | "none";
  provider: string;
  maskedApiKey: string;
  baseUrl: string;
  model: string;
  lastUpdatedUtc?: string;
}

const PROVIDER_PRESETS = [
  {
    id: "gemini",
    name: "Google Gemini (AI Studio)",
    badge: "Khuyên Dùng • Miễn Phí",
    description: "Miễn phí qua Google AI Studio. Tốc độ cao, phân tích giáo trình và bài học cực chuẩn.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-1.5-flash",
    modelOptions: ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    badge: "Tiêu Chuẩn",
    description: "Sử dụng GPT-4o-mini hoặc GPT-4o từ OpenAI qua API Key chính thức.",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    modelOptions: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "custom",
    name: "Tùy Chỉnh (Local LLM / OpenRouter / DeepSeek)",
    badge: "Nâng Cao",
    description: "Tự host Ollama, LM Studio hoặc sử dụng OpenRouter, Groq, DeepSeek qua chuẩn OpenAI.",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    modelOptions: ["llama3.2", "deepseek-chat", "qwen2.5"],
    keyPlaceholder: "Nhập API Key hoặc để trống nếu dùng local...",
    docsUrl: "https://ollama.com",
    color: "from-purple-500 to-rose-600",
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AiSettingsState>({
    isConfigured: false,
    source: "none",
    provider: "gemini",
    maskedApiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-1.5-flash",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("https://generativelanguage.googleapis.com/v1beta/openai/");
  const [modelInput, setModelInput] = useState("gemini-1.5-flash");
  const [showApiKey, setShowApiKey] = useState(false);

  // Testing & Saving status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active guide tab
  const [activeGuideTab, setActiveGuideTab] = useState<"database" | "env">("database");

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAiSettings();
      setSettings(data);
      if (data.provider) {
        setSelectedProvider(data.provider);
      }
      if (data.baseUrl) {
        setBaseUrlInput(data.baseUrl);
      }
      if (data.model) {
        setModelInput(data.model);
      }
    } catch (err) {
      console.error("Failed to fetch AI settings", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSelectPreset = (presetId: string) => {
    setSelectedProvider(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setBaseUrlInput(preset.defaultBaseUrl);
      setModelInput(preset.defaultModel);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAiConnection({
        provider: selectedProvider,
        apiKey: apiKeyInput.trim() || undefined,
        baseUrl: baseUrlInput.trim(),
        model: modelInput.trim(),
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Lỗi kiểm tra kết nối",
        error: err.message || "Unknown error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!apiKeyInput.trim() && !settings.isConfigured) {
      setTestResult({
        success: false,
        message: "Vui lòng nhập API Key trước khi lưu.",
      });
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);
    try {
      const updated = await api.saveAiSettings({
        provider: selectedProvider,
        apiKey: apiKeyInput.trim(),
        baseUrl: baseUrlInput.trim(),
        model: modelInput.trim(),
      });
      setSettings(updated);
      setApiKeyInput("");
      setSaveSuccessMessage("Đã mã hóa và lưu API Key thành công vào PostgreSQL cục bộ!");
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Không thể lưu cài đặt vào Database",
        error: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDbKey = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa API Key khỏi Database? Hệ thống sẽ chuyển sang dùng biến môi trường .env nếu có.")) {
      return;
    }
    setIsDeleting(true);
    try {
      const updated = await api.deleteAiSettings();
      setSettings(updated);
      setApiKeyInput("");
      setTestResult(null);
      setSaveSuccessMessage("Đã xóa Key trong Database. Đang sử dụng cấu hình mặc định hoặc .env.");
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      alert("Lỗi khi xóa key: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
              <Link href="/admin/builder" className="hover:text-orange-500 transition-colors">
                Quản Trị
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-700 dark:text-slate-300">Cài Đặt Hệ Thống</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <KeyRound className="w-7 h-7 text-orange-500" />
              Cài Đặt AI & Quản Lý API Key
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quản lý API Key cho tính năng AI bóc tách giáo trình và tạo bài học tự động (Hỗ trợ PostgreSQL cục bộ & file .env).
            </p>
          </div>

          <button
            onClick={loadSettings}
            disabled={isLoading}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-orange-500" : ""}`} />
            Làm mới
          </button>
        </div>

        {/* ── Status Overview Card ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Box 1: Status */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                settings.isConfigured
                  ? settings.source === "database"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              {settings.isConfigured ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Trạng Thái AI</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {settings.isConfigured
                    ? settings.source === "database"
                      ? "Đã Cấu Hình (Database)"
                      : "Đang Dùng (.env)"
                    : "Chưa Cấu Hình"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {settings.isConfigured
                  ? `Mã nguồn: ${settings.source === "database" ? "PostgreSQL Local (Mã hóa)" : "File .env / Docker"}`
                  : "Cần cấu hình API Key để kích hoạt AI"}
              </p>
            </div>
          </div>

          {/* Box 2: Current Masked Key */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">API Key Đang Lưu</span>
              <div className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {settings.maskedApiKey || "Chưa có key"}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {settings.lastUpdatedUtc
                  ? `Cập nhật: ${new Date(settings.lastUpdatedUtc).toLocaleDateString("vi-VN")}`
                  : "Bảo mật Server-to-Server"}
              </p>
            </div>
          </div>

          {/* Box 3: Model & Provider */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Engine / Mô Hình</span>
              <div className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 truncate uppercase">
                {settings.provider} • {settings.model}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Bóc tách giáo trình & Tạo bài học
              </p>
            </div>
          </div>
        </div>

        {/* ── Main Configuration Form Card ── */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Cấu Hình Nhà Cung Cấp AI (AI Provider)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Chọn dịch vụ AI bạn muốn sử dụng. Hệ thống tự động tối ưu cấu trúc gọi API theo chuẩn OpenAI compatible endpoint.
            </p>
          </div>

          {/* Provider Preset Selector Pills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PROVIDER_PRESETS.map((preset) => {
              const isSelected = selectedProvider === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-3 ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 shadow-sm ring-2 ring-orange-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-orange-500/10 text-orange-600 dark:text-orange-400 mb-2">
                      {preset.badge}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Mặc định: {preset.defaultModel}</span>
                    <a
                      href={preset.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      Lấy Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* API Key Input */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>API Key</span>
                {settings.isConfigured && (
                  <span className="text-[11px] font-normal text-slate-400">
                    Đang lưu: <span className="font-mono">{settings.maskedApiKey}</span>
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    settings.isConfigured
                      ? "Nhập API Key mới để thay đổi (hoặc để trống nếu giữ nguyên key hiện tại)"
                      : PROVIDER_PRESETS.find((p) => p.id === selectedProvider)?.keyPlaceholder || "Nhập API Key..."
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono text-slate-900 dark:text-white pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                🔒 API Key được mã hóa chuẩn AES-256 trước khi lưu vào PostgreSQL cục bộ. Trình duyệt không bao giờ lưu key thô.
              </p>
            </div>

            {/* Base URL Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Endpoint Base URL
              </label>
              <input
                type="text"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400">
                Google AI Studio dùng: <code className="text-orange-500">https://generativelanguage.googleapis.com/v1beta/openai/</code>
              </p>
            </div>

            {/* Model Name Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tên Model (Model ID)
              </label>
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="gemini-1.5-flash / gpt-4o-mini"
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400">
                Khuyên dùng: <span className="font-mono text-orange-500">gemini-1.5-flash</span> (miễn phí, nhanh, độ trễ thấp).
              </p>
            </div>
          </div>

          {/* Test Connection Alert Box */}
          {testResult && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              )}
              <div className="text-xs">
                <div className="font-bold flex items-center gap-2">
                  <span>{testResult.message}</span>
                  {testResult.latencyMs !== undefined && testResult.latencyMs > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px]">
                      ⏱ {testResult.latencyMs} ms
                    </span>
                  )}
                </div>
                {testResult.error && (
                  <p className="mt-1 text-[11px] opacity-90 font-mono break-all">
                    {testResult.error}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {saveSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold transition-all active:scale-95 disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 text-amber-500 ${isTesting ? "animate-bounce" : ""}`} />
                <span>{isTesting ? "Đang kiểm tra kết nối..." : "Kiểm Tra Kết Nối (Test Key)"}</span>
              </button>

              {settings.source === "database" && (
                <button
                  type="button"
                  onClick={handleDeleteDbKey}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-bold transition-all"
                  title="Xóa API Key khỏi Database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Key Database</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-extrabold shadow-md shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Đang lưu..." : "Lưu Cài Đặt Vào Database"}</span>
            </button>
          </div>
        </div>

        {/* ── Self-Host Guide & Documentation ── */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Hướng Dẫn Cho Dân Self-Host
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lựa chọn phương thức cấu hình phù hợp với hạ tầng triển khai của bạn
                </p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveGuideTab("database")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeGuideTab === "database"
                    ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                1. Giao Diện Web (Database)
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab("env")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeGuideTab === "env"
                    ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                2. File .env / Docker Compose
              </button>
            </div>
          </div>

          {activeGuideTab === "database" ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex flex-col gap-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Cơ Chế Bảo Mật PostgreSQL Local (AES-256):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 pl-1">
                <li>Người dùng nhập key trên form ở trên và bấm <strong>"Lưu Cài Đặt"</strong>.</li>
                <li>Backend .NET tiếp nhận, mã hóa bằng AES-256 dựa trên Secret Key máy chủ rồi lưu vào bảng <code className="text-orange-500 font-mono">SystemSettings</code>.</li>
                <li><strong>Trình duyệt không lưu key:</strong> Khi tải trang, API chỉ gửi về dạng masked (<code className="font-mono">AIzaSy...4x8A</code>).</li>
                <li><strong>Server-to-Server:</strong> Toàn bộ các yêu cầu bóc tách PDF hoặc tạo câu hỏi đều chạy trực tiếp từ container Backend sang Google AI Studio.</li>
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nếu bạn muốn cấu hình tĩnh hoàn toàn không qua giao diện web, chỉ cần thêm biến môi trường vào file <code className="text-orange-500 font-mono">.env</code> hoặc <code className="text-orange-500 font-mono">docker-compose.yml</code>:
              </p>
              <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
                <div className="text-slate-500 mb-1"># File .env tại thư mục gốc dự án</div>
                <div className="text-emerald-400">GEMINI_API_KEY=AIzaSyYourGoogleStudioKeyHere</div>
                <div className="text-slate-400">AI__Provider=gemini</div>
                <div className="text-slate-400">AI__Model=gemini-1.5-flash</div>
                <div className="text-slate-400 mt-2"># Sau đó chạy lệnh:</div>
                <div className="text-amber-400">docker compose up -d</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
