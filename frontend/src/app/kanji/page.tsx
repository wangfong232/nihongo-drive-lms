"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { KANJI_DATABASE, RADICALS_LIST, KanjiItem } from "@/lib/kanji-data";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import {
  BookOpen,
  Search,
  Pencil,
  Sparkles,
  Layers,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  CheckCircle2,
  ExternalLink,
  Flame,
  Star,
  Loader2,
} from "lucide-react";

const KanjiCanvas = dynamic(
  () => import("@/components/learner/KanjiCanvas").then((mod) => mod.KanjiCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-slate-400 text-xs gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        <span>Đang nạp công cụ vẽ Kanji...</span>
      </div>
    ),
  }
);

export default function KanjiHubPage() {
  const { t } = useI18n();
  const { isKanjiFavorite, toggleKanjiFavorite, favoriteKanjis } = useFavorites();

  // Filters State
  const [selectedJlpt, setSelectedJlpt] = useState<string>("all");
  const [selectedRadical, setSelectedRadical] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [strokeFilter, setStrokeFilter] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);

  // Selected Kanji for Practice Modal
  const [activeKanji, setActiveKanji] = useState<KanjiItem | null>(null);

  // Filtered Kanji list
  const filteredKanjiList = useMemo(() => {
    return KANJI_DATABASE.filter((item) => {
      // Favorites Filter
      if (showFavoritesOnly && !isKanjiFavorite(item.character)) return false;

      // JLPT Filter
      if (!showFavoritesOnly && selectedJlpt !== "all" && item.jlpt !== selectedJlpt) return false;

      // Radical Filter
      if (selectedRadical !== "all" && item.radical !== selectedRadical) return false;

      // Stroke Count Filter
      if (strokeFilter === "1-4" && (item.strokeCount < 1 || item.strokeCount > 4)) return false;
      if (strokeFilter === "5-8" && (item.strokeCount < 5 || item.strokeCount > 8)) return false;
      if (strokeFilter === "9-12" && (item.strokeCount < 9 || item.strokeCount > 12)) return false;
      if (strokeFilter === "13+" && item.strokeCount < 13) return false;

      // Search query (character, hanViet, meaning, onyomi, kunyomi, examples)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchChar = item.character.toLowerCase().includes(q);
        const matchHanViet = item.hanViet.toLowerCase().includes(q);
        const matchMeaning = item.meaning.toLowerCase().includes(q);
        const matchOn = item.onyomi.some((o) => o.toLowerCase().includes(q));
        const matchKun = item.kunyomi.some((k) => k.toLowerCase().includes(q));
        const matchEx = item.examples.some(
          (ex) =>
            ex.word.toLowerCase().includes(q) ||
            ex.reading.toLowerCase().includes(q) ||
            ex.meaning.toLowerCase().includes(q)
        );

        if (!matchChar && !matchHanViet && !matchMeaning && !matchOn && !matchKun && !matchEx) {
          return false;
        }
      }

      return true;
    });
  }, [selectedJlpt, selectedRadical, strokeFilter, searchQuery, showFavoritesOnly, favoriteKanjis]);

  // Navigate next / prev in modal
  const handleNextKanji = () => {
    if (!activeKanji) return;
    const idx = filteredKanjiList.findIndex((k) => k.id === activeKanji.id);
    if (idx !== -1 && idx < filteredKanjiList.length - 1) {
      setActiveKanji(filteredKanjiList[idx + 1]);
    } else if (filteredKanjiList.length > 0) {
      setActiveKanji(filteredKanjiList[0]);
    }
  };

  const handlePrevKanji = () => {
    if (!activeKanji) return;
    const idx = filteredKanjiList.findIndex((k) => k.id === activeKanji.id);
    if (idx > 0) {
      setActiveKanji(filteredKanjiList[idx - 1]);
    } else if (filteredKanjiList.length > 0) {
      setActiveKanji(filteredKanjiList[filteredKanjiList.length - 1]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900/5 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 pt-20">
        {/* Header Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-wider">
                Kanji Master Hub
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-orange-500 font-black text-2xl">漢</span>
                Kho Tra Cứu & Luyện Viết Chữ Hán
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tổng hợp Chữ Hán JLPT N5 — N1, phân loại theo 214 Bộ thủ, tra cứu Âm Hán Việt, On/Kun và luyện viết từng nét với hoạt ảnh tương tác.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
                {filteredKanjiList.length}
              </div>
              <div className="text-left">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Chữ Hán Hiển Thị</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {selectedJlpt === "all" ? "Tất cả cấp độ" : `Cấp độ ${selectedJlpt}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Search & Filters Control Center ─────────────────────────────── */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col gap-4">
          {/* Top Row: Search input & JLPT level tabs */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* JLPT Level Tabs + Favorite Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: "Tất Cả" },
                { id: "N5", label: "JLPT N5" },
                { id: "N4", label: "JLPT N4" },
                { id: "N3", label: "JLPT N3" },
                { id: "N2", label: "JLPT N2" },
                { id: "N1", label: "JLPT N1" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => {
                    setShowFavoritesOnly(false);
                    setSelectedJlpt(lvl.id);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    !showFavoritesOnly && selectedJlpt === lvl.id
                      ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}

              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  showFavoritesOnly
                    ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Yêu Thích ({favoriteKanjis.length})</span>
              </button>
            </div>

            {/* Search Input & Stroke filter */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo chữ Hán, Hán Việt, Romaji, nghĩa (VD: Nhật, nichi, người)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <select
                value={strokeFilter}
                onChange={(e) => setStrokeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none"
              >
                <option value="all">Số Nét: Tất Cả</option>
                <option value="1-4">1 — 4 nét</option>
                <option value="5-8">5 — 8 nét</option>
                <option value="9-12">9 — 12 nét</option>
                <option value="13+">13+ nét</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: 214 Radicals (Bộ Thủ) Horizontal Carousel */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                Lọc Theo Bộ Thủ Gốc:
              </span>
              {selectedRadical !== "all" && (
                <button
                  onClick={() => setSelectedRadical("all")}
                  className="text-orange-600 dark:text-orange-400 font-bold hover:underline"
                >
                  Xóa lọc bộ thủ (Hiện tất cả)
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                onClick={() => setSelectedRadical("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedRadical === "all"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                Tất Cả Bộ Thủ
              </button>

              {RADICALS_LIST.map((rad) => (
                <button
                  key={rad.radical}
                  onClick={() => setSelectedRadical(rad.radical)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all border ${
                    selectedRadical === rad.radical
                      ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/40"
                      : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-orange-400"
                  }`}
                >
                  <span className="text-sm font-black">{rad.radical}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({rad.name})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Kanji Cards Grid ────────────────────────────────────────────── */}
        {filteredKanjiList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/60">
            Không tìm thấy chữ Hán nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredKanjiList.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveKanji(item)}
                className="group p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-orange-500/50 dark:hover:border-orange-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden"
              >
                {/* Accent Hover Stripe */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Top: Kanji & Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold text-[10px]">
                        {item.jlpt}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleKanjiFavorite(item.character);
                        }}
                        title={isKanjiFavorite(item.character) ? "Bỏ yêu thích" : "Lưu vào chữ Hán yêu thích"}
                        className={`p-1 rounded-lg border transition-all ${
                          isKanjiFavorite(item.character)
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500"
                        }`}
                      >
                        <Star className={`w-3 h-3 ${isKanjiFavorite(item.character) ? "fill-amber-500 text-amber-500" : ""}`} />
                      </button>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 font-mono">
                      {item.strokeCount} nét • {item.radicalName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 my-2">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-3xl font-black text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:scale-110 transition-all shadow-inner">
                      {item.character}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white tracking-wide uppercase">
                        {item.hanViet}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {item.meaning}
                      </p>
                    </div>
                  </div>

                  {/* Readings */}
                  <div className="flex flex-col gap-1 text-[11px] mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-bold w-9 shrink-0">On:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {item.onyomi.length > 0 ? item.onyomi.join(", ") : "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-bold w-9 shrink-0">Kun:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {item.kunyomi.length > 0 ? item.kunyomi.join(", ") : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Practice Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveKanji(item);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 group-hover:bg-orange-600 text-slate-700 dark:text-slate-300 group-hover:text-white font-bold text-xs transition-all shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Tập Viết & Xem Nét</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ════════════════════════════ KANJI PRACTICE MODAL ════════════════════════════ */}
      {activeKanji && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-4xl w-full flex flex-col gap-6 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-orange-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-orange-500/30">
                  {activeKanji.character}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold text-[10px]">
                      {activeKanji.jlpt}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-wide">
                      Chữ Hán: <span className="text-orange-600 dark:text-orange-400">{activeKanji.hanViet}</span>
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeKanji.meaning} • {activeKanji.strokeCount} nét • {activeKanji.radicalName} ({activeKanji.radical})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleKanjiFavorite(activeKanji.character)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isKanjiFavorite(activeKanji.character)
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-500"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500"
                  }`}
                  title={isKanjiFavorite(activeKanji.character) ? "Bỏ yêu thích" : "Lưu vào chữ Hán yêu thích"}
                >
                  <Star className={`w-3.5 h-3.5 ${isKanjiFavorite(activeKanji.character) ? "fill-amber-500 text-amber-500" : ""}`} />
                  <span className="hidden sm:inline">{isKanjiFavorite(activeKanji.character) ? "Đã Lưu Yêu Thích" : "Lưu Yêu Thích"}</span>
                </button>

                <button
                  onClick={handlePrevKanji}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  title="Chữ Hán trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextKanji}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  title="Chữ Hán tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveKanji(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Canvas vs Details) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: HanziWriter Canvas (7 cols) */}
              <div className="md:col-span-7 flex flex-col items-center justify-center p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <KanjiCanvas
                  kanji={activeKanji.character}
                  size={290}
                  hanViet={activeKanji.hanViet}
                  meaning={activeKanji.meaning}
                />
              </div>

              {/* Right Column: Readings, Meaning & Examples (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-4">
                {/* On / Kun Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Cách Đọc Âm On & Kun
                  </h4>
                  <div className="text-xs flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-[10px] shrink-0">
                        Onyomi
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeKanji.onyomi.length > 0 ? activeKanji.onyomi.join("、") : "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] shrink-0">
                        Kunyomi
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeKanji.kunyomi.length > 0 ? activeKanji.kunyomi.join("、") : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Common Words & Examples */}
                <div className="flex flex-col gap-2 flex-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-orange-500" />
                    Từ Vựng Ghép Thường Gặp
                  </h4>

                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {activeKanji.examples.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-0.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-black text-sm text-slate-900 dark:text-white">
                            {ex.word}
                          </span>
                          <span className="font-semibold text-xs text-orange-600 dark:text-orange-400">
                            {ex.reading}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {ex.meaning}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">
                Sử dụng các phím mũi tên hoặc nút Next/Prev để chuyển nhanh chữ Hán.
              </span>
              <button
                onClick={() => setActiveKanji(null)}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md transition-all active:scale-95"
              >
                Hoàn Thành Luyện Viết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
