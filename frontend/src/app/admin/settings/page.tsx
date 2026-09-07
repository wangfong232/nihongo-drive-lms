"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import {
  api,
  AiSettings,
  DriveSettings,
  TestAiConnectionResult,
  VerifyDriveConnectionResult,
} from "@/lib/api";
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
  FolderSync,
  Database,
  Cloud,
  FolderGit2,
  Sliders,
} from "lucide-react";

const PROVIDER_PRESETS = [
  {
    id: "gemini",
    name: "Google Gemini (AI Studio)",
    badge: "Khuyên Dùng • Miễn Phí",
    description: "Miễn phí qua Google AI Studio. Tốc độ cao, phân tích giáo trình và bài học cực chuẩn.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-3.1-flash-lite",
    modelOptions: [
      { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite", badge: "Mới & Nhanh Nhất (Khuyên dùng)" },
      { id: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite", badge: "Thử Nghiệm" },
      { id: "gemini-3.6-flash", label: "gemini-3.6-flash", badge: "Hiệu Năng Cao" },
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash", badge: "Ổn Định" },
      { id: "gemini-1.5-flash", label: "gemini-1.5-flash", badge: "Tiêu Chuẩn" },
      { id: "gemini-1.5-pro", label: "gemini-1.5-pro", badge: "Suy Luận Sâu" },
    ],
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
    modelOptions: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini", badge: "Nhanh & Tiết Kiệm" },
      { id: "gpt-4o", label: "gpt-4o", badge: "Chính Xác Cao" },
      { id: "gpt-3.5-turbo", label: "gpt-3.5-turbo", badge: "Cơ Bản" },
    ],
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
    modelOptions: [
      { id: "llama3.2", label: "llama3.2", badge: "Local Ollama" },
      { id: "deepseek-chat", label: "deepseek-chat", badge: "DeepSeek API" },
      { id: "qwen2.5", label: "qwen2.5", badge: "Alibaba Cloud" },
    ],
    keyPlaceholder: "Nhập API Key hoặc để trống nếu dùng local...",
    docsUrl: "https://ollama.com",
    color: "from-purple-500 to-rose-600",
  },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"ai" | "drive" | "guide">("ai");

  // AI Settings State
  const [aiSettings, setAiSettings] = useState<AiSettings>({
    isConfigured: false,
    source: "none",
    provider: "gemini",
    maskedApiKey: "",
    hasApiKey: false,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    selectedModel: "gemini-3.1-flash-lite",
    availableModels: [],
  });

  const [isLoadingAi, setIsLoadingAi] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("https://generativelanguage.googleapis.com/v1beta/openai/");
  const [modelInput, setModelInput] = useState("gemini-3.1-flash-lite");
  const [showApiKey, setShowApiKey] = useState(false);

  // AI Testing & Saving
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<TestAiConnectionResult | null>(null);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [isDeletingAi, setIsDeletingAi] = useState(false);

  // Drive Settings State
  const [driveSettings, setDriveSettings] = useState<DriveSettings>({
    isConfigured: false,
    source: "none",
    clientId: "",
    maskedClientSecret: "",
    hasClientSecret: false,
    maskedRefreshToken: "",
    hasRefreshToken: false,
    rootFolderId: "",
  });

  const [isLoadingDrive, setIsLoadingDrive] = useState(true);
  const [driveClientIdInput, setDriveClientIdInput] = useState("");
  const [driveClientSecretInput, setDriveClientSecretInput] = useState("");
  const [driveRefreshTokenInput, setDriveRefreshTokenInput] = useState("");
  const [driveRootFolderIdInput, setDriveRootFolderIdInput] = useState("");
  const [showDriveSecret, setShowDriveSecret] = useState(false);
  const [showDriveRefresh, setShowDriveRefresh] = useState(false);

  // Drive Testing & Saving
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveTestResult, setDriveTestResult] = useState<VerifyDriveConnectionResult | null>(null);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveSuccessMessage, setDriveSuccessMessage] = useState<string | null>(null);

  // Active guide subtab
  const [activeGuideTab, setActiveGuideTab] = useState<"database" | "env">("database");

  // Load initial settings
  const loadAllSettings = async () => {
    setIsLoadingAi(true);
    setIsLoadingDrive(true);

    try {
      const [aiData, driveData] = await Promise.all([
        api.getAiSettings(),
        api.getDriveSettings(),
      ]);

      setAiSettings(aiData);
      if (aiData.provider) setSelectedProvider(aiData.provider);
      if (aiData.baseUrl) setBaseUrlInput(aiData.baseUrl);
      if (aiData.selectedModel) setModelInput(aiData.selectedModel);

      setDriveSettings(driveData);
      if (driveData.clientId) setDriveClientIdInput(driveData.clientId);
      if (driveData.rootFolderId) setDriveRootFolderIdInput(driveData.rootFolderId);
    } catch (err) {
      console.error("Failed to fetch system settings", err);
    } finally {
      setIsLoadingAi(false);
      setIsLoadingDrive(false);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const handleSelectPreset = (presetId: string) => {
    setSelectedProvider(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setBaseUrlInput(preset.defaultBaseUrl);
      setModelInput(preset.defaultModel);
    }
  };

  // AI Connection Test
  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await api.testAiConnection({
        provider: selectedProvider,
        apiKey: apiKeyInput.trim() || undefined,
        baseUrl: baseUrlInput.trim(),
        model: modelInput.trim(),
      });
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: "Lỗi kết nối AI",
        error: err.message || "Unknown error",
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  // Save AI Settings (can switch model without re-entering key)
  const handleSaveAiSettings = async () => {
    if (!apiKeyInput.trim() && !aiSettings.hasApiKey && !aiSettings.isConfigured) {
      setAiTestResult({
        success: false,
        message: "Vui lòng nhập API Key trước khi lưu.",
      });
      return;
    }

    setIsSavingAi(true);
    setAiSuccessMessage(null);
    try {
      const updated = await api.updateAiSettings({
        provider: selectedProvider,
        apiKey: apiKeyInput.trim() || undefined,
        baseUrl: baseUrlInput.trim(),
        selectedModel: modelInput.trim(),
      });
      setAiSettings(updated);
      setApiKeyInput("");
      setAiSuccessMessage(
        `Đã lưu cấu hình AI thành công! Mô hình đang hoạt động: ${updated.selectedModel}`
      );
      setTimeout(() => setAiSuccessMessage(null), 6000);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: "Không thể lưu cài đặt AI vào Database",
        error: err.message,
      });
    } finally {
      setIsSavingAi(false);
    }
  };

  // Quick switch model and save immediately
  const handleQuickSelectModel = async (modelId: string) => {
    setModelInput(modelId);
    if (aiSettings.isConfigured || aiSettings.hasApiKey) {
      setIsSavingAi(true);
      try {
        const updated = await api.updateAiSettings({
          provider: selectedProvider,
          baseUrl: baseUrlInput.trim(),
          selectedModel: modelId,
        });
        setAiSettings(updated);
        setAiSuccessMessage(`Đã chuyển sang mô hình: ${modelId}`);
        setTimeout(() => setAiSuccessMessage(null), 4000);
      } catch (err: any) {
        console.error("Failed to quickly update model", err);
      } finally {
        setIsSavingAi(false);
      }
    }
  };

  const handleDeleteAiDbKey = async () => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn xóa API Key khỏi Database? Hệ thống sẽ chuyển sang dùng biến môi trường .env nếu có."
      )
    ) {
      return;
    }
    setIsDeletingAi(true);
    try {
      const updated = await api.deleteAiSettings();
      setAiSettings(updated);
      setApiKeyInput("");
      setAiTestResult(null);
      setAiSuccessMessage("Đã xóa Key trong Database. Đang sử dụng cấu hình mặc định hoặc .env.");
      setTimeout(() => setAiSuccessMessage(null), 5000);
    } catch (err: any) {
      alert("Lỗi khi xóa key: " + err.message);
    } finally {
      setIsDeletingAi(false);
    }
  };

  // Google Drive Verify
  const handleVerifyDrive = async () => {
    setIsTestingDrive(true);
    setDriveTestResult(null);
    try {
      const res = await api.verifyDriveConnection({
        clientId: driveClientIdInput.trim() || undefined,
        clientSecret: driveClientSecretInput.trim() || undefined,
        refreshToken: driveRefreshTokenInput.trim() || undefined,
        rootFolderId: driveRootFolderIdInput.trim() || undefined,
      });
      setDriveTestResult(res);
    } catch (err: any) {
      setDriveTestResult({
        success: false,
        message: "Lỗi kiểm tra kết nối Google Drive",
        error: err.message || "Unknown error",
      });
    } finally {
      setIsTestingDrive(false);
    }
  };

  // Google Drive Save Settings
  const handleSaveDriveSettings = async () => {
    setIsSavingDrive(true);
    setDriveSuccessMessage(null);
    try {
      const updated = await api.updateDriveSettings({
        clientId: driveClientIdInput.trim() || undefined,
        clientSecret: driveClientSecretInput.trim() || undefined,
        refreshToken: driveRefreshTokenInput.trim() || undefined,
        rootFolderId: driveRootFolderIdInput.trim() || undefined,
      });
      setDriveSettings(updated);
      setDriveClientSecretInput("");
      setDriveRefreshTokenInput("");
      setDriveSuccessMessage("Đã mã hóa và lưu cấu hình Google Drive thành công!");
      setTimeout(() => setDriveSuccessMessage(null), 5000);
    } catch (err: any) {
      setDriveTestResult({
        success: false,
        message: "Không thể lưu cấu hình Google Drive",
        error: err.message,
      });
    } finally {
      setIsSavingDrive(false);
    }
  };

  const currentPreset = PROVIDER_PRESETS.find((p) => p.id === selectedProvider) || PROVIDER_PRESETS[0];

  return (
    <div className="min-h-screen bg-[#f8f9ff] dark:bg-[#090d16] flex flex-col font-sans transition-colors">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Breadcrumb & Title Card */}
        <div className="bento-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">
              <Link href="/admin/builder" className="hover:text-emerald-600 transition-colors">
                Quản Trị
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-800 dark:text-slate-200">Cài Đặt Hệ Thống</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              Cài Đặt Hệ Thống & Bảo Mật Secrets
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
              Quản lý API Key AI (Gemini 3.1, 3.5, 3.6), Credentials Google Drive Sync & mã hóa bằng ASP.NET Core Data Protection.
            </p>
          </div>

          <button
            onClick={loadAllSettings}
            disabled={isLoadingAi || isLoadingDrive}
            className="btn-tactile-secondary self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 text-xs font-black cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingAi || isLoadingDrive ? "animate-spin text-emerald-600" : ""}`} />
            <span>Làm Mới Cấu Hình</span>
          </button>
        </div>

        {/* ── Status Overview Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: AI Provider Status */}
          <div className="bento-card p-5 flex items-center gap-4 hover:border-emerald-500/40 transition-colors">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                aiSettings.isConfigured
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              {aiSettings.isConfigured ? <ShieldCheck className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Trạng Thái AI</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  {aiSettings.isConfigured
                    ? aiSettings.source === "database"
                      ? "Đã Cấu Hình (Database)"
                      : "Đang Dùng (.env)"
                    : "Chưa Cấu Hình"}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {aiSettings.maskedApiKey ? `Key: ${aiSettings.maskedApiKey}` : "Chưa có Key"}
              </p>
            </div>
          </div>

          {/* Card 2: Active Model */}
          <div className="bento-card p-5 flex items-center gap-4 hover:border-purple-500/40 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-sm">
              <Cpu className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Mô Hình Đang Dùng</span>
              <div className="font-mono text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                {aiSettings.selectedModel || "gemini-3.1-flash-lite"}
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {aiSettings.provider ? `Provider: ${aiSettings.provider.toUpperCase()}` : "Gemini Studio"}
              </p>
            </div>
          </div>

          {/* Card 3: Google Drive Sync Status */}
          <div className="bento-card p-5 flex items-center gap-4 hover:border-sky-500/40 transition-colors">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                driveSettings.isConfigured
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                  : "bg-slate-500/15 text-slate-600 dark:text-slate-400"
              }`}
            >
              <FolderSync className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Google Drive Sync</span>
              <div className="font-black text-sm sm:text-base text-slate-900 dark:text-white mt-0.5 truncate">
                {driveSettings.isConfigured ? "Đã Cấu Hình Token" : "Chưa Cấu Hình"}
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {driveSettings.rootFolderId ? `Folder: ${driveSettings.rootFolderId.substring(0, 10)}...` : "Chưa gắn Root Folder"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation Pills ── */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl w-fit border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "ai"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Provider & Mô Hình</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("drive")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "drive"
                ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>Google Drive Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "guide"
                ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Hướng Dẫn Self-Host (.env)</span>
          </button>
        </div>

        {/* ── TAB 1: AI Provider & Models ── */}
        {activeTab === "ai" && (
          <div className="bento-card p-6 sm:p-8 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                Cấu Hình Nhà Cung Cấp AI & Lựa Chọn Mô Hình
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Bạn có thể tự do chuyển đổi mô hình (ví dụ: gemini-3.1-flash-lite, gemini-3.5-flash-lite, gemini-3.6-flash) bất cứ lúc nào mà không cần nhập lại API Key.
              </p>
            </div>

            {/* Provider Preset Selector Pills */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {PROVIDER_PRESETS.map((preset) => {
                const isSelected = selectedProvider === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mb-2">
                        {preset.badge}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Mặc định: {preset.defaultModel}</span>
                      <a
                        href={preset.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        Lấy Key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Model Selector Pills */}
            <div className="flex flex-col gap-2.5 p-4.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Chọn Nhanh Mô Hình (Model Selector):
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Click để chọn ngay không cần nhập lại Key
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {currentPreset.modelOptions.map((opt) => {
                  const isCurrent = modelInput === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleQuickSelectModel(opt.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                        isCurrent
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800"
                      }`}
                    >
                      <span className="font-mono font-bold">{opt.label}</span>
                      {opt.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black ${
                            isCurrent
                              ? "bg-black/20 text-white"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* API Key Input */}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>API Key</span>
                  {aiSettings.hasApiKey && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Key đã lưu an toàn: <span className="font-mono">{aiSettings.maskedApiKey}</span>
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      aiSettings.hasApiKey
                        ? "Để trống nếu bạn muốn giữ nguyên API Key đã lưu (chỉ đổi Model hoặc Base URL)"
                        : currentPreset.keyPlaceholder || "Nhập API Key..."
                    }
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono text-slate-900 dark:text-white pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] font-medium text-slate-400">
                  🔒 Secrets được mã hóa tự động bằng ASP.NET Core Data Protection trước khi lưu vào PostgreSQL cục bộ.
                </p>
              </div>

              {/* Base URL Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Endpoint Base URL
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 font-medium">
                  Google AI Studio dùng: <code className="text-emerald-600 font-bold">https://generativelanguage.googleapis.com/v1beta/openai/</code>
                </p>
              </div>

              {/* Model Name Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Tên Model Tuỳ Chỉnh (Model ID)
                </label>
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="gemini-3.1-flash-lite"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 font-medium">
                  Model đang active: <span className="font-mono text-emerald-600 font-black">{modelInput}</span>
                </p>
              </div>
            </div>

            {/* Test Connection Alert Box */}
            {aiTestResult && (
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                  aiTestResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                {aiTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-2">
                    <span>{aiTestResult.message}</span>
                    {aiTestResult.latencyMs !== undefined && aiTestResult.latencyMs > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                        ⏱ {aiTestResult.latencyMs} ms
                      </span>
                    )}
                    {aiTestResult.modelUsed && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold">
                        Model: {aiTestResult.modelUsed}
                      </span>
                    )}
                  </div>
                  {aiTestResult.error && (
                    <p className="mt-1 text-[11px] opacity-90 font-mono break-all">
                      {aiTestResult.error}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {aiSuccessMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{aiSuccessMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi}
                  className="btn-tactile-secondary px-4 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 text-amber-500 ${isTestingAi ? "animate-bounce" : ""}`} />
                  <span>{isTestingAi ? "Đang kiểm tra kết nối..." : "Kiểm Tra Kết Nối AI (Test Key)"}</span>
                </button>

                {aiSettings.source === "database" && (
                  <button
                    type="button"
                    onClick={handleDeleteAiDbKey}
                    disabled={isDeletingAi}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer"
                    title="Xóa API Key khỏi Database"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Key Database</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={isSavingAi}
                className="btn-tactile-emerald px-6 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingAi ? "Đang lưu..." : "Lưu Cài Đặt AI"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: Google Drive Sync Settings ── */}
        {activeTab === "drive" && (
          <div className="bento-card p-6 sm:p-8 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-sky-500" />
                Cấu Hình Kết Nối & Đồng Bộ Google Drive
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Lưu trữ OAuth Client Credentials và Refresh Token an toàn. Kiểm tra kết nối trực tiếp đến Google Drive API để xác nhận quyền truy cập.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Client ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Google OAuth Client ID
                </label>
                <input
                  type="text"
                  value={driveClientIdInput}
                  onChange={(e) => setDriveClientIdInput(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              {/* Client Secret */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Client Secret</span>
                  {driveSettings.hasClientSecret && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Đã lưu: <span className="font-mono">{driveSettings.maskedClientSecret}</span>
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showDriveSecret ? "text" : "password"}
                    value={driveClientSecretInput}
                    onChange={(e) => setDriveClientSecretInput(e.target.value)}
                    placeholder={
                      driveSettings.hasClientSecret
                        ? "Để trống nếu muốn giữ nguyên Secret đã lưu"
                        : "GOCSPX-..."
                    }
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-mono text-slate-900 dark:text-white pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDriveSecret(!showDriveSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showDriveSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Refresh Token */}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Google OAuth Refresh Token</span>
                  {driveSettings.hasRefreshToken && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Đã lưu: <span className="font-mono">{driveSettings.maskedRefreshToken}</span>
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showDriveRefresh ? "text" : "password"}
                    value={driveRefreshTokenInput}
                    onChange={(e) => setDriveRefreshTokenInput(e.target.value)}
                    placeholder={
                      driveSettings.hasRefreshToken
                        ? "Để trống nếu muốn giữ nguyên Refresh Token đã lưu"
                        : "1//04..."
                    }
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-mono text-slate-900 dark:text-white pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDriveRefresh(!showDriveRefresh)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showDriveRefresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Root Folder ID */}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Google Drive Root Folder ID
                </label>
                <input
                  type="text"
                  value={driveRootFolderIdInput}
                  onChange={(e) => setDriveRootFolderIdInput(e.target.value)}
                  placeholder="14MD4svpbhKvo6odQoGxvAgQTRSachRiz"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-mono text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 font-medium">
                  ID của thư mục gốc chứa các khóa học và tài liệu trên Google Drive (Lấy từ URL: drive.google.com/drive/folders/<strong>ID</strong>).
                </p>
              </div>
            </div>

            {/* Drive Verify Result Box */}
            {driveTestResult && (
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                  driveTestResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                {driveTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-2">
                    <span>{driveTestResult.message}</span>
                    {driveTestResult.latencyMs !== undefined && driveTestResult.latencyMs > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                        ⏱ {driveTestResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  {driveTestResult.rootFolderName && (
                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      Tên thư mục gốc: <strong className="font-semibold">{driveTestResult.rootFolderName}</strong>
                      {driveTestResult.topLevelItemsCount !== undefined && (
                        <span> • Tổng mục cấp 1: <strong>{driveTestResult.topLevelItemsCount}</strong></span>
                      )}
                    </div>
                  )}
                  {driveTestResult.error && (
                    <p className="mt-1 text-[11px] opacity-90 font-mono break-all">
                      {driveTestResult.error}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {driveSuccessMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{driveSuccessMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleVerifyDrive}
                disabled={isTestingDrive}
                className="btn-tactile-secondary px-4 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 text-sky-500 ${isTestingDrive ? "animate-bounce" : ""}`} />
                <span>{isTestingDrive ? "Đang kiểm tra kết nối..." : "Kiểm Tra Kết Nối Drive (Verify)"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDriveSettings}
                disabled={isSavingDrive}
                className="btn-tactile-emerald px-6 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingDrive ? "Đang lưu..." : "Lưu Cấu Hình Drive"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 3: Self-Host Guide & Documentation ── */}
        {activeTab === "guide" && (
          <div className="bento-card p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Hướng Dẫn Cho Dân Self-Host
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Lựa chọn phương thức cấu hình phù hợp với hạ tầng triển khai của bạn
                  </p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveGuideTab("database")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    activeGuideTab === "database"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  1. Giao Diện Web (Database)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGuideTab("env")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    activeGuideTab === "env"
                      ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  2. File .env / Docker Compose
                </button>
              </div>
            </div>

            {activeGuideTab === "database" ? (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex flex-col gap-2.5">
                <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Cơ Chế Bảo Mật PostgreSQL Local (ASP.NET Core Data Protection):</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-slate-500 dark:text-slate-400 pl-1 font-medium">
                  <li>Người dùng nhập API Key và Model trên giao diện Web rồi bấm <strong>"Lưu Cài Đặt"</strong>.</li>
                  <li>Backend tiếp nhận, mã hóa secrets bằng <code className="text-emerald-600 font-mono font-bold">IDataProtector</code> rồi lưu vào bảng <code className="text-emerald-600 font-mono font-bold">SystemSettings</code>.</li>
                  <li><strong>Đổi Model độc lập:</strong> Cho phép đổi mô hình (gemini-3.1-flash-lite, gemini-3.5, gemini-3.6) với 1 cú click mà không cần gõ lại API Key.</li>
                  <li><strong>Trình duyệt không lưu key thô:</strong> API chỉ trả về chuỗi masked (<code className="font-mono">AIzaSy••••</code>).</li>
                  <li><strong>Server-to-Server:</strong> Toàn bộ các yêu cầu bóc tách PDF hoặc tạo câu hỏi đều chạy trực tiếp từ container Backend sang Google AI Studio.</li>
                </ul>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Nếu bạn muốn cấu hình tĩnh hoàn toàn không qua giao diện web, chỉ cần thêm biến môi trường vào file <code className="text-purple-600 font-mono font-bold">.env</code> hoặc <code className="text-purple-600 font-mono font-bold">docker-compose.yml</code>:
                </p>
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
                  <div className="text-slate-500 mb-1 font-sans font-bold"># File .env tại thư mục gốc dự án</div>
                  <div className="text-emerald-400 font-bold">GEMINI_API_KEY=AIzaSyYourGoogleStudioKeyHere</div>
                  <div className="text-slate-400">AI__Provider=gemini</div>
                  <div className="text-slate-400">AI__Model=gemini-3.1-flash-lite</div>
                  <div className="text-slate-400 mt-2 font-sans font-bold"># Google Drive OAuth credentials:</div>
                  <div className="text-sky-400">Authentication__Google__ClientId=your_client_id</div>
                  <div className="text-sky-400">Authentication__Google__ClientSecret=your_client_secret</div>
                  <div className="text-slate-400 mt-2 font-sans font-bold"># Sau đó chạy lệnh:</div>
                  <div className="text-amber-400 font-bold">docker compose up -d</div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

